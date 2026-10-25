import { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import type { WaAdapter } from "waconector"
import { waha } from "waconector/waha"
import { evolution } from "waconector/evolution"
import { zapi } from "waconector/zapi"
import { uazapi } from "waconector/uazapi"
import { whapi } from "waconector/whapi"
import { wuzapi } from "waconector/wuzapi"
import { quepasa } from "waconector/quepasa"
import { wppconnect } from "waconector/wppconnect"
import { izapia } from "waconector/izapia"

export const IZAPIA_BASE_URL = "https://api.izapia.com"

/**
 * Adaptador para canais conectados por API externa (waconector).
 *
 * Retorna `undefined` — sem lançar — quando o canal não é do modo `external`
 * (por exemplo o modo `native`, que é atendido por `@/whatsapp-native`) ou
 * quando o provider gravado é desconhecido. Quem chama decide como reportar;
 * isso mantém um canal mal configurado incapaz de derrubar o processo.
 */
export function buildExternalAdapter(
  channel: ConfigAgentUIV1.WhatsAppChannelBinding,
  sidOverride?: string,
): WaAdapter | undefined {
  if (ConfigAgentUIV1.whatsappMode(channel) !== "external") return undefined

  const cfg = channel.config ?? {}
  switch (channel.provider) {
    case "waha":
      return waha({ baseUrl: cfg.baseUrl ?? "", apiKey: cfg.apiKey, session: sidOverride ?? cfg.session })
    case "evolution":
      return evolution({ baseUrl: cfg.baseUrl ?? "", apiKey: cfg.apiKey ?? "", instance: sidOverride ?? cfg.instance ?? cfg.instanceName ?? "" })
    case "zapi":
      return zapi({ instanceId: sidOverride ?? cfg.instanceId ?? "", token: cfg.token ?? "", clientToken: cfg.clientToken })
    case "uazapi":
      return uazapi({ baseUrl: cfg.baseUrl ?? "", token: cfg.token ?? "", adminToken: cfg.adminToken })
    case "whapi":
      return whapi({ token: cfg.token ?? "" })
    case "wuzapi":
      return wuzapi({ baseUrl: cfg.baseUrl ?? "", token: cfg.token ?? cfg.userToken ?? "" })
    case "quepasa":
      return quepasa({ baseUrl: cfg.baseUrl ?? "", token: cfg.token ?? "" })
    case "wppconnect":
      return wppconnect({ baseUrl: cfg.baseUrl ?? "", session: sidOverride ?? cfg.session ?? "", token: cfg.token ?? cfg.secretKey ?? "" })
    case "izapia":
      return izapia({
        baseUrl: cfg.baseUrl || IZAPIA_BASE_URL,
        apiKey: cfg.apiKey ?? "",
        sid: sidOverride || channel.sessionIds?.[0] || cfg.sid || "",
      })
    default:
      return undefined
  }
}

export class WhatsAppExternalAdapterUnsupportedError extends Error {
  readonly _tag = "WhatsAppExternalAdapterUnsupportedError"
  constructor(readonly provider: string | undefined) {
    super(
      provider
        ? `Canal WhatsApp não usa API externa (provider "${provider}"). Configure o modo "external" ou use a conexão nativa.`
        : `Canal WhatsApp sem provider de API externa configurado.`,
    )
  }
}

/**
 * Variante estrita usada nos caminhos que já sabem que o canal é `external`
 * (webhook de entrada, resposta de webhook). Nesses pontos um canal nativo é um
 * erro de configuração e deve aparecer como erro tipado no fluxo Effect — nunca
 * como exceção não tratada que derrube o sidecar.
 */
export function buildAdapter(channel: ConfigAgentUIV1.WhatsAppChannelBinding, sidOverride?: string): WaAdapter {
  const adapter = buildExternalAdapter(channel, sidOverride)
  if (!adapter) throw new WhatsAppExternalAdapterUnsupportedError(channel.provider)
  return adapter
}
