import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./media.txt"
import { WhatsAppNative } from "@/whatsapp-native"
import { agentForSession, chatForSession, getAgentUI } from "@/whatsapp-native/bindings"
import { findMedia, listMedia, MediaLibraryError, type MediaEntry, type MediaListing } from "@/media-library"

export const Parameters = Schema.Struct({
  action: Schema.Literals(["list", "find", "send"]).annotate({
    description: "AÃ§Ã£o: list (navegar), find (buscar por nome) ou send (enviar pelo WhatsApp).",
  }),
  path: Schema.optional(Schema.String).annotate({
    description:
      "Em list: pasta a listar (caminho absoluto retornado antes, ou relativo Ã  primeira pasta configurada). Vazio = lista as raÃ­zes.",
  }),
  depth: Schema.optional(Schema.Number).annotate({
    description: "Em list: quantos nÃ­veis descer (1-3, padrÃ£o 1).",
  }),
  query: Schema.optional(Schema.String).annotate({
    description: "Em find: trecho do nome do arquivo (sem diferenciar maiÃºsculas).",
  }),
  limit: Schema.optional(Schema.Number).annotate({
    description: "Limite de arquivos retornados (padrÃ£o 200 em list, 50 em find).",
  }),
  file: Schema.optional(Schema.String).annotate({
    description: "Em send: caminho EXATO do arquivo retornado por list/find.",
  }),
  to: Schema.optional(Schema.String).annotate({
    description: "Em send: destinatÃ¡rio (nÃºmero com DDI/DDD ou JID de grupo).",
  }),
  caption: Schema.optional(Schema.String).annotate({
    description: "Em send: legenda da mÃ­dia.",
  }),
})

type Params = Schema.Schema.Type<typeof Parameters>

export const MediaTool = Tool.define(
  "media",
  Effect.gen(function* () {
    const native = yield* WhatsAppNative.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Params, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "media",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          const agentUI = getAgentUI()
          const agentId = agentForSession(ctx.sessionID)
          if (!agentUI || !agentId) {
            return done("Biblioteca de mÃ­dia", "Erro: nÃ£o consegui identificar o agente desta sessÃ£o.")
          }

          const agent = yield* agentUI.get(agentId).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const roots = (agent?.mediaDirs ?? []).filter((dir) => dir.trim())
          if (roots.length === 0) {
            return done(
              "Biblioteca de mÃ­dia",
              "Erro: este agente nÃ£o tem pastas de mÃ­dia configuradas. PeÃ§a ao usuÃ¡rio para preencher 'Pastas de mÃ­dia' no AgentUI.",
            )
          }

          switch (params.action) {
            case "list": {
              const listing = yield* Effect.tryPromise({
                try: () => listMedia({ roots, path: params.path, depth: params.depth, limit: params.limit }),
                catch: (error) => error,
              }).pipe(Effect.catch((error) => Effect.succeed<MediaLibraryError | MediaListing>(error as MediaLibraryError)))
              if (listing instanceof Error) return done("Biblioteca de mÃ­dia", `Erro: ${listing.message}`)
              return done(summarizeFolder(listing), formatListing(listing))
            }

            case "find": {
              if (!params.query?.trim()) return done("Busca de mÃ­dia", "Erro: informe 'query' para buscar arquivos.")
              const found = yield* Effect.tryPromise({
                try: () => findMedia({ roots, query: params.query!, limit: params.limit }),
                catch: (error) => error,
              }).pipe(Effect.catch((error) => Effect.succeed(error as MediaLibraryError)))
              if (found instanceof Error) return done("Busca de mÃ­dia", `Erro: ${found.message}`)
              return done(
                `Busca: ${found.query}`,
                JSON.stringify(
                  {
                    roots: found.roots,
                    query: found.query,
                    truncated: found.truncated,
                    results: found.results.map(formatEntry),
                  },
                  null,
                  2,
                ),
              )
            }

            case "send": {
              if (!params.file) return done("Envio de mÃ­dia", "Erro: informe 'file' com o caminho retornado por list/find.")
              // SessÃµes de canal estÃ£o presas a UMA conversa: usar o chat de
              // origem e ignorar `to` evita que o modelo invente o destinatÃ¡rio.
              const to = chatForSession(ctx.sessionID) || params.to?.trim()
              if (!to) return done("Envio de mÃ­dia", "Erro: informe 'to' com o destinatÃ¡rio.")
              const result = yield* native
                .sendMedia({
                  agentId,
                  to,
                  media: params.file,
                  caption: params.caption,
                })
                .pipe(Effect.catch((error) => Effect.succeed({ error: error.message })))
              return done("Mídia enviada", JSON.stringify({ ...result, to }, null, 2))
            }
          }
        }),
    }
  }),
)

function done(title: string, output: string) {
  return { title, output, metadata: {} }
}

function formatEntry(entry: MediaEntry) {
  return {
    name: entry.name,
    path: entry.path,
    kind: entry.kind,
    sizeKB: Math.round(entry.size / 1024),
    modifiedAt: new Date(entry.modifiedAt).toISOString(),
  }
}

function summarizeFolder(listing: MediaListing): string {
  if (!listing.folder) return "Pastas de mÃ­dia"
  return `Pasta: ${listing.folder}`
}

function formatListing(listing: MediaListing): string {
  return JSON.stringify(
    {
      roots: listing.roots,
      folder: listing.folder ?? "(raÃ­zes)",
      truncated: listing.truncated,
      folders: listing.folders.map((folder) => ({
        name: folder.name,
        path: folder.path,
        mediaFiles: folder.files,
        subfolders: folder.subfolders,
      })),
      files: listing.files.map(formatEntry),
    },
    null,
    2,
  )
}
