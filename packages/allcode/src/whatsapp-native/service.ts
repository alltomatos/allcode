import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { WhatsAppNativeManager } from "./manager"
import { whatsappNativeDbPath, whatsappNativeProfile } from "./store"
import {
  WhatsAppNativeStatus,
  WhatsAppNativeEvent,
  WhatsAppNativeNotConfiguredError,
  WhatsAppNativeStateError,
  WhatsAppNativeOperationError,
} from "./schema"
import { AgentUI } from "@/agentui"
import { Global } from "@allcode/core/global"
import { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"

export interface Interface {
  readonly getStatus: (agentId: string) => Effect.Effect<WhatsAppNativeStatus>
  readonly connect: (
    agentId: string,
  ) => Effect.Effect<
    WhatsAppNativeStatus,
    | WhatsAppNativeNotConfiguredError
    | WhatsAppNativeStateError
    | WhatsAppNativeOperationError
    | AgentUI.AgentUINotFoundError
  >
  readonly logout: (agentId: string) => Effect.Effect<void, WhatsAppNativeOperationError>
  readonly subscribeEvents: (
    agentId: string,
    listener: (event: WhatsAppNativeEvent) => void,
  ) => Effect.Effect<() => void>
  readonly sendText: (input: {
    agentId: string
    to: string
    text: string
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly listChats: (input: {
    agentId: string
    limit?: number
  }) => Effect.Effect<{ jid: string; unreadCount?: number }[], WhatsAppNativeOperationError>
  readonly listGroups: (input: {
    agentId: string
    onlyAdmin?: boolean
  }) => Effect.Effect<
    {
      jid: string
      subject: string
      participantCount: number
      isAdmin: boolean
      isSuperAdmin: boolean
      creation?: number
      desc?: string
    }[],
    WhatsAppNativeOperationError
  >
  readonly listGroupParticipants: (input: {
    agentId: string
    groupId: string
  }) => Effect.Effect<
    {
      jid: string
      name?: string
      phone?: string
      isAdmin: boolean
      isSuperAdmin: boolean
    }[],
    WhatsAppNativeOperationError
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/WhatsAppNative") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const agentUI = yield* AgentUI.Service
    const manager = new WhatsAppNativeManager()
    console.log(
      `[WhatsApp Native] serviço iniciado profile=${whatsappNativeProfile()} db=${whatsappNativeDbPath()} configDir=${Global.Path.config}`,
    )

    const getStatus = (agentId: string) => Effect.sync(() => manager.getStatus(agentId))

    const connect = (agentId: string) =>
      Effect.gen(function* () {
        const agent = yield* agentUI.get(agentId)
        let channel = agent.channels.find(
          (c): c is ConfigAgentUIV1.WhatsAppChannelBinding =>
            c.type === "whatsapp" && ConfigAgentUIV1.isNativeWhatsAppChannel(c),
        )
        if (!channel) {
          // Se o agente ainda tem outro provider salvo mas o usuário acabou de acionar a conexão nativa,
          // fornece fallback de configuração padrão nativa para permitir o pareamento imediato
          channel = {
            type: "whatsapp",
            mode: "native",
            provider: ConfigAgentUIV1.WHATSAPP_NATIVE_PROVIDER_PLACEHOLDER,
            config: {},
          } as ConfigAgentUIV1.WhatsAppChannelBinding
        }
        return yield* manager.connect(agentId, channel, agentUI)
      })

    const logout = (agentId: string) => manager.logout(agentId)

    const subscribeEvents = (agentId: string, listener: (event: WhatsAppNativeEvent) => void) =>
      Effect.sync(() => manager.addListener(agentId, listener))

    const sendText = (input: { agentId: string; to: string; text: string }) =>
      Effect.gen(function* () {
        const session = manager.getSession(input.agentId)
        if (!session?.client || session.state !== "connected") {
          return yield* Effect.fail(
            new WhatsAppNativeOperationError({
              message: `Sessão WhatsApp nativa do agente ${input.agentId} não está conectada`,
              agentId: input.agentId,
            }),
          )
        }
        const result = yield* Effect.tryPromise({
          try: () => session.client!.message.send(input.to, input.text),
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Falha ao enviar mensagem de texto para ${input.to}: ${String(err)}`,
              agentId: input.agentId,
            }),
        })
        return { messageId: (result as any)?.id }
      })

    const listChats = (input: { agentId: string; limit?: number }) =>
      Effect.gen(function* () {
        const session = manager.getSession(input.agentId)
        if (!session?.client) {
          return yield* Effect.fail(
            new WhatsAppNativeOperationError({
              message: `Sessão WhatsApp nativa do agente ${input.agentId} não inicializada`,
              agentId: input.agentId,
            }),
          )
        }
        const threads = yield* Effect.tryPromise({
          try: async () => {
            const list = await (session.client as any).threads?.list?.({ limit: input.limit ?? 50 })
            return ((list || []) as any[]).map((t: any) => ({
              jid: (t.jid || t.id) as string,
              unreadCount: t.unreadCount as number | undefined,
            }))
          },
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Falha ao listar conversas: ${String(err)}`,
              agentId: input.agentId,
            }),
        })
        return threads
      })

    const listGroups = (input: { agentId: string; onlyAdmin?: boolean }) =>
      Effect.gen(function* () {
        const session = manager.getSession(input.agentId)
        if (!session?.client || session.state !== "connected") {
          return yield* Effect.fail(
            new WhatsAppNativeOperationError({
              message: `Sessão WhatsApp nativa do agente ${input.agentId} não está conectada`,
              agentId: input.agentId,
            }),
          )
        }
        const client = session.client
        const groups = yield* Effect.tryPromise({
          try: async () => {
            const myJid = client.getCredentials()?.meJid
            const myPhone = myJid ? myJid.split("@")[0].split(":")[0] : ""
            const all = await client.group.queryAllGroups()
            const result = all.map((g: any) => {
              // Verifica se o usuário atual é admin nos participantes
              const meParticipant = (g.participants || []).find((p: any) => {
                const pJid = p.jid || ""
                return (
                  (myJid && pJid.includes(myJid.split(":")[0])) ||
                  (myPhone && pJid.includes(myPhone))
                )
              })
              const isAdmin = meParticipant ? meParticipant.isAdmin || meParticipant.isSuperAdmin : false
              const isSuperAdmin = meParticipant ? meParticipant.isSuperAdmin : false

              return {
                jid: g.jid,
                subject: g.subject || "(Sem assunto)",
                participantCount: g.size ?? (g.participants?.length ?? 0),
                isAdmin,
                isSuperAdmin,
                creation: g.creation,
                desc: g.desc,
              }
            })

            if (input.onlyAdmin) {
              return result.filter((g) => g.isAdmin)
            }
            return result
          },
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Falha ao listar grupos: ${String(err)}`,
              agentId: input.agentId,
            }),
        })
        return groups
      })

    const listGroupParticipants = (input: { agentId: string; groupId: string }) =>
      Effect.gen(function* () {
        const session = manager.getSession(input.agentId)
        if (!session?.client || session.state !== "connected") {
          return yield* Effect.fail(
            new WhatsAppNativeOperationError({
              message: `Sessão WhatsApp nativa do agente ${input.agentId} não está conectada`,
              agentId: input.agentId,
            }),
          )
        }
        const client = session.client
        const participants = yield* Effect.tryPromise({
          try: async () => {
            const meta = await client.group.queryGroupMetadata(input.groupId)
            const parts = (meta.participants || []) as any[]
            return parts.map((p) => {
              const jid: string = p.jid || ""
              const phone = p.phoneNumber || jid.split("@")[0].split(":")[0]
              return {
                jid,
                name: p.displayName || p.username || phone,
                phone,
                isAdmin: Boolean(p.isAdmin || p.isSuperAdmin),
                isSuperAdmin: Boolean(p.isSuperAdmin),
              }
            })
          },
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Falha ao obter participantes do grupo ${input.groupId}: ${String(err)}`,
              agentId: input.agentId,
            }),
        })
        return participants
      })

    const reconcileAgents = Effect.gen(function* () {
      const agents = yield* agentUI.list()
      const { store } = yield* Effect.tryPromise(() => manager.getStore()).pipe(
        Effect.catch(() => Effect.succeed({ store: undefined })),
      )

      // Agentes que deveriam ter uma sessão nativa agora. Qualquer sessão viva
      // fora deste conjunto (agente removido, desativado ou trocado para o modo
      // `external`) é encerrada — nunca deixamos duas conexões disputando a
      // mesma conta.
      const expected = new Set<string>()

      for (const agent of agents) {
        if (!ConfigAgentUIV1.isEnabled(agent)) {
          console.log(`[WhatsApp Native Reconcile] agente desativado: ${agent.id}`)
          continue
        }
        const channel = agent.channels.find(
          (c): c is ConfigAgentUIV1.WhatsAppChannelBinding =>
            c.type === "whatsapp" && ConfigAgentUIV1.isNativeWhatsAppChannel(c),
        )
        if (!channel) {
          console.log(
            `[WhatsApp Native Reconcile] sem canal nativo: ${agent.id} channels=${JSON.stringify(agent.channels.map((c) => ("type" in c ? c.type : "?")))}`,
          )
          continue
        }

        expected.add(agent.id)

        const currentSession = manager.getSession(agent.id)
        if (currentSession?.state === "connected" || currentSession?.state === "connecting") continue

        // Se tem credenciais salvas no banco SQLite (auth.load), reconecta automaticamente sem pedir QR
        if (store) {
          const sessionStore = store.session(agent.id)
          const creds = yield* Effect.tryPromise(() => sessionStore.auth.load()).pipe(
            Effect.catch(() => Effect.succeed(undefined)),
          )
          if (creds && creds.meJid) {
            console.log(
              `[WhatsApp Native Reconcile] reconectando ${agent.id} (${creds.meJid}) mode=${ConfigAgentUIV1.whatsappMode(channel)} provider=${channel.provider ?? "-"}`,
            )
            // catchCause (não catch): uma config/estado inesperado de UM agente
            // não pode matar o supervisor nem derrubar o processo.
            yield* manager.connect(agent.id, channel, agentUI).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("Falha na auto-reconexão do WhatsApp nativo", {
                  agentId: agent.id,
                  error: String(cause),
                }),
              ),
            )
          }
        }
      }

      for (const session of manager.listSessions()) {
        if (expected.has(session.agentId)) continue
        yield* manager.disconnect(session.agentId).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Falha ao encerrar sessão nativa órfã", {
              agentId: session.agentId,
              error: String(cause),
            }),
          ),
        )
      }
    })

    // Roda o supervisor em background a cada 5 segundos (mesmo padrão do Telegram)
    yield* Effect.forkScoped(
      reconcileAgents.pipe(
        Effect.catchCause((cause) => Effect.logError("WhatsApp native reconcile failed", { cause })),
        Effect.andThen(() => Effect.sleep("5 seconds")),
        Effect.forever,
      ),
    )

    return Service.of({
      getStatus,
      connect,
      logout,
      subscribeEvents,
      sendText,
      listChats,
      listGroups,
      listGroupParticipants,
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [AgentUI.node],
})
