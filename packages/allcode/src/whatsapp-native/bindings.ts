import type { Effect } from "effect"
import type { ChannelBinding } from "@allcode/core/v1/config/agentui"

/**
 * Vínculos de sessão de canal sem dependência de serviço.
 *
 * Por que existe: a tool `whatsapp` precisa saber qual agente do AgentUI é o
 * dono da sessão em que está rodando, mas `ToolRegistry` não pode depender de
 * `AgentUI` (AgentUI → SessionPrompt → ToolRegistry criaria um ciclo de layers).
 * Este módulo é um ponto de encontro simples, sem imports de nenhum dos dois
 * lados: o AgentUI registra o vínculo e a própria instância; a tool consulta.
 */

export interface ChannelAgent {
  readonly id: string
  readonly name: string
  readonly channels: readonly ChannelBinding[]
  readonly enabled?: boolean
}

/** Superfície do AgentUI usada pelo serviço nativo (não depende do layer). */
export interface ChannelAgentUI {
  readonly get: (id: string) => Effect.Effect<ChannelAgent, unknown>
  readonly list: () => Effect.Effect<readonly ChannelAgent[], unknown>
  readonly dispatchChannelMessage: (input: {
    id: string
    directory: string
    chatKey: string
    message: string
    attachments?: readonly { filename?: string; mime: string; url: string }[]
    channel?: "whatsapp" | "telegram" | "sandbox"
  }) => Effect.Effect<{ reply: string; blocked: boolean }, unknown>
}

const sessionAgents = new Map<string, string>()
let agentUI: ChannelAgentUI | undefined

export function setAgentUI(service: ChannelAgentUI): void {
  agentUI = service
}

export function getAgentUI(): ChannelAgentUI | undefined {
  return agentUI
}

export function bindSessionAgent(sessionID: string, agentID: string): void {
  sessionAgents.set(sessionID, agentID)
}

export function unbindSessionAgent(sessionID: string): void {
  sessionAgents.delete(sessionID)
}

export function agentForSession(sessionID: string): string | undefined {
  return sessionAgents.get(sessionID)
}
