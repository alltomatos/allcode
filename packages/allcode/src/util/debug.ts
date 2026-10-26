import { Flag } from "@allcode/core/flag/flag"

/**
 * Logs de diagnóstico dos canais (AgentUI/WhatsApp). Silenciosos por padrão:
 * o envio de mensagens não deve despejar conteúdo de conversa no terminal.
 * Ligue com OPENCODE_DEBUG_AGENTUI=1.
 */
export function debug(...args: unknown[]) {
  if (!Flag.OPENCODE_DEBUG_AGENTUI) return
  console.log(...args)
}
