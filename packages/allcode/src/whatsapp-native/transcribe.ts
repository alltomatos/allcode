import { Duration, Effect, Schema } from "effect"
import { debug } from "@/util/debug"
import type { Provider } from "@/provider/provider"

/**
 * Transcrição de áudio recebido no WhatsApp nativo.
 *
 * Usa o endpoint de transcrição do provider configurado. A ordem tenta o
 * provider explícito (`AGENTUI_TRANSCRIPTION_MODEL=provider/modelo`) e depois
 * provedores conhecidos que exponham `/audio/transcriptions` no formato
 * OpenAI. Nenhum provider disponível vira erro tipado — o chamador transforma
 * isso em contexto para o agente, sem derrubar a sessão.
 */

export class TranscriptionError extends Schema.TaggedErrorClass<TranscriptionError>()("TranscriptionError", {
  reason: Schema.String,
}) {
  override get message() {
    return `Falha na transcrição: ${this.reason}`
  }
}

const PROVIDER_MODELS: Record<string, readonly string[]> = {
  openai: ["gpt-4o-mini-transcribe", "whisper-1"],
  groq: ["whisper-large-v3-turbo", "whisper-large-v3"],
}

// Gateways OpenAI-compatible (OmniRoute, AgentRouter, OpenRouter) costumam
// aceitar `whisper-1` em `/audio/transcriptions`; tentamos por último.
const COMPATIBLE_MODELS: readonly string[] = ["whisper-1"]

const TIMEOUT_MS = 90_000

/**
 * Resolve a transcrição para texto. O provider é opcional para que o manager
 * continue funcionando em processos onde o grafo de provider não foi montado.
 */
export function transcribeAudio(
  provider: Provider.Interface,
  input: { bytes: Uint8Array; mime: string; filename: string },
): Effect.Effect<string, TranscriptionError> {
  return Effect.gen(function* () {
    debug("[Transcription] resolving provider list")
    const providers = Object.fromEntries(
      Object.entries(
        yield* provider.list().pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(3),
            orElse: () => Effect.succeed({} as Record<string, Provider.Info>),
          }),
          Effect.catchCause(() => Effect.succeed({} as Record<string, Provider.Info>)),
        ),
      ),
    ) as Record<string, Provider.Info>
    const configured = process.env.AGENTUI_TRANSCRIPTION_MODEL?.trim()
    const candidates = resolveCandidates(providers, configured)
    debug(`[Transcription] providers=${Object.keys(providers).join(",")} candidates=${candidates.map((c) => `${c.providerID}/${c.modelID}`).join(",")}`)

    if (candidates.length === 0) {
      return yield* new TranscriptionError({
        reason:
          "nenhum provider com endpoint de transcrição está conectado. Conecte OpenAI/Groq ou defina AGENTUI_TRANSCRIPTION_MODEL.",
      })
    }

    let lastError = "nenhum modelo de transcrição respondeu"
    for (const candidate of candidates) {
      debug(`[Transcription] trying ${candidate.providerID}/${candidate.modelID}`)
      const result = yield* Effect.option(
        runTranscription(candidate, providers[candidate.providerID], input).pipe(
          Effect.timeoutOrElse({
            duration: Duration.seconds(45),
            orElse: () => Effect.fail(new TranscriptionError({ reason: "timeout na transcrição" })),
          }),
        ),
      )
      if (result._tag === "Some") return result.value
      debug(`[Transcription] failed ${candidate.providerID}/${candidate.modelID}`)
      lastError = `provider ${candidate.providerID}/${candidate.modelID} falhou`
    }

    return yield* new TranscriptionError({ reason: lastError })
  })
}

interface Candidate {
  readonly providerID: string
  readonly modelID: string
}

function resolveCandidates(
  providers: Record<string, Provider.Info>,
  configured: string | undefined,
): Candidate[] {
  const result: Candidate[] = []

  if (configured) {
    const separator = configured.indexOf("/")
    if (separator > 0) {
      const providerID = configured.slice(0, separator)
      const modelID = configured.slice(separator + 1)
      if (providers[providerID]) result.push({ providerID, modelID })
    }
  }

  for (const [providerID, models] of Object.entries(PROVIDER_MODELS)) {
    const provider = providers[providerID]
    if (!provider || !hasCredentials(provider)) continue
    for (const modelID of models) result.push({ providerID, modelID })
  }

  for (const provider of Object.values(providers)) {
    if (!hasCredentials(provider)) continue
    if (provider.id in PROVIDER_MODELS) continue
    if (!isOpenAICompatible(provider)) continue
    for (const modelID of COMPATIBLE_MODELS) result.push({ providerID: provider.id, modelID })
  }

  return result
}

function runTranscription(
  candidate: Candidate,
  provider: Provider.Info | undefined,
  input: { bytes: Uint8Array; mime: string; filename: string },
): Effect.Effect<string, TranscriptionError> {
  return Effect.gen(function* () {
    if (!provider) {
      return yield* new TranscriptionError({ reason: `provider ${candidate.providerID} não encontrado` })
    }
    const apiKey = provider.key ?? stringOption(provider.options.apiKey)
    if (!apiKey) {
      return yield* new TranscriptionError({ reason: `provider ${candidate.providerID} sem credencial` })
    }

    const model = yield* Effect.tryPromise({
      try: async () => {
        const baseURL = stringOption(provider.options.baseURL)
        if (provider.id === "groq") {
          const { createGroq } = await import("@ai-sdk/groq")
          return createGroq({ apiKey, ...(baseURL ? { baseURL } : {}) }).transcription(candidate.modelID)
        }
        const { createOpenAI } = await import("@ai-sdk/openai")
        return createOpenAI({ name: provider.id, apiKey, ...(baseURL ? { baseURL } : {}) }).transcription(
          candidate.modelID,
        )
      },
      catch: (error) => new TranscriptionError({ reason: errorMessage(error) }),
    })

    const result = yield* Effect.tryPromise({
      try: async () => {
        const { experimental_transcribe: transcribe } = await import("ai")
        return transcribe({
          model,
          audio: input.bytes,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        })
      },
      catch: (error) => new TranscriptionError({ reason: errorMessage(error) }),
    })

    const text = result.text?.trim()
    if (!text) {
      return yield* new TranscriptionError({ reason: `provider ${candidate.providerID} devolveu transcrição vazia` })
    }
    return text
  })
}

function hasCredentials(provider: Provider.Info): boolean {
  return Boolean(provider.key ?? stringOption(provider.options.apiKey))
}

function isOpenAICompatible(provider: Provider.Info): boolean {
  const npm = Object.values(provider.models)[0]?.api.npm ?? ""
  return npm.includes("openai-compatible") || npm === "@ai-sdk/openai" || provider.id === "openai"
}

function stringOption(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export * as WhatsAppTranscription from "./transcribe"
