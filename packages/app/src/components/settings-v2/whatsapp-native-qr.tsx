import { createSignal, onCleanup, onMount, Show, For, type Component } from "solid-js"
import QRCode from "qrcode"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { useServer } from "@/context/server"

export interface WhatsAppNativeQrCardProps {
  agentId: string
  enabled: boolean
  allowedGroups?: string[]
  onToggleGroup?: (groupJid: string, enabled: boolean) => void
  onConfigureGroupParticipants?: (group: { jid: string; subject: string; participantCount: number }) => void
  onAutoSave?: () => Promise<void>
}

export const WhatsAppNativeQrCard: Component<WhatsAppNativeQrCardProps> = (props) => {
  const server = useServer()
  const [state, setState] = createSignal<string>("idle")
  const [qrCode, setQrCode] = createSignal<string | undefined>()
  const [qrDataUrl, setQrDataUrl] = createSignal<string | undefined>()
  const [ttlMs, setTtlMs] = createSignal<number | undefined>()
  const [connectedPhone, setConnectedPhone] = createSignal<string | undefined>()
  const [error, setError] = createSignal<string | undefined>()
  const [loading, setLoading] = createSignal(false)
  const [groups, setGroups] = createSignal<any[]>([])
  const [loadingGroups, setLoadingGroups] = createSignal(false)

  let eventSource: EventSource | undefined

  const baseUrl = () => server.current?.http.url?.replace(/\/$/, "") ?? ""

  const loadGroups = async () => {
    if (!props.agentId || !baseUrl()) return
    setLoadingGroups(true)
    try {
      const res = await fetch(`${baseUrl()}/whatsapp/native/${props.agentId}/groups`, {
        headers: {
          ...(server.current?.http.username && server.current?.http.password
            ? {
                Authorization: `Basic ${btoa(
                  `${server.current.http.username}:${server.current.http.password}`,
                )}`,
              }
            : {}),
        },
      })
      if (res.ok) {
        const data = await res.json()
        setGroups(Array.isArray(data) ? data : [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingGroups(false)
    }
  }

  const loadStatus = async () => {
    if (!props.agentId || !baseUrl()) return
    try {
      const res = await fetch(`${baseUrl()}/whatsapp/native/${props.agentId}`, {
        headers: {
          ...(server.current?.http.username && server.current?.http.password
            ? {
                Authorization: `Basic ${btoa(
                  `${server.current.http.username}:${server.current.http.password}`,
                )}`,
              }
            : {}),
        },
      })
      if (res.ok) {
        const data = await res.json()
        setState(data.state)
        setConnectedPhone(data.phone)
        setError(data.lastError)
      }
    } catch {
      // ignore
    }
  }

  const connectEvents = () => {
    if (!props.agentId || !baseUrl() || eventSource) return
    const url = `${baseUrl()}/whatsapp/native/${props.agentId}/events`
    eventSource = new EventSource(url)

    eventSource.onmessage = async (evt) => {
      try {
        const payload = JSON.parse(evt.data)
        setState(payload.state)
        if (payload.qr) {
          setQrCode(payload.qr)
          const dataUrl = await QRCode.toDataURL(payload.qr, {
            width: 240,
            margin: 2,
            errorCorrectionLevel: "M",
          })
          setQrDataUrl(dataUrl)
        } else if (payload.state === "connected" || payload.state === "paired") {
          setQrCode(undefined)
          setQrDataUrl(undefined)
        }
        if (payload.ttlMs) setTtlMs(payload.ttlMs)
        if (payload.phone) setConnectedPhone(payload.phone)
        if (payload.error) setError(payload.error)
      } catch {
        // ignore
      }
    }

    eventSource.onerror = () => {
      // EventSource reconecta automaticamente
    }
  }

  const disconnectEvents = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = undefined
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    setError(undefined)
    try {
      if (props.onAutoSave) {
        await props.onAutoSave()
      }
      connectEvents()
      const res = await fetch(`${baseUrl()}/whatsapp/native/${props.agentId}/connect`, {
        method: "POST",
        headers: {
          ...(server.current?.http.username && server.current?.http.password
            ? {
                Authorization: `Basic ${btoa(
                  `${server.current.http.username}:${server.current.http.password}`,
                )}`,
              }
            : {}),
        },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError(errData.message || "Falha ao iniciar pareamento nativo")
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch(`${baseUrl()}/whatsapp/native/${props.agentId}/logout`, {
        method: "POST",
        headers: {
          ...(server.current?.http.username && server.current?.http.password
            ? {
                Authorization: `Basic ${btoa(
                  `${server.current.http.username}:${server.current.http.password}`,
                )}`,
              }
            : {}),
        },
      })
      setState("disconnected")
      setQrCode(undefined)
      setQrDataUrl(undefined)
      setConnectedPhone(undefined)
      setError(undefined)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void loadStatus()
    connectEvents()
  })

  onCleanup(() => {
    disconnectEvents()
  })

  return (
    <div class="flex flex-col gap-3 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-01/30 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class={`size-2.5 rounded-full ${
              state() === "connected"
                ? "bg-emerald-500"
                : state() === "connecting" || state() === "qr_ready"
                ? "bg-amber-500 animate-pulse"
                : "bg-v2-text-text-muted"
            }`}
          />
          <span class="text-13-medium text-v2-text-text-base">
            Conexão WhatsApp Nativa (zapo)
          </span>
        </div>
        <span class="font-mono text-11-regular text-v2-text-text-muted uppercase">
          {state()}
        </span>
      </div>

      <Show when={error()}>
        <div class="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-12-regular text-rose-400">
          {error()}
        </div>
      </Show>

      <Show when={state() === "connected"}>
        <div class="flex flex-col gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div class="flex items-center justify-between">
            <span class="text-13-medium text-emerald-400">WhatsApp Conectado</span>
            <Show when={connectedPhone()}>
              <span class="font-mono text-12-medium text-emerald-300">
                +{connectedPhone()}
              </span>
            </Show>
          </div>
          <p class="text-11-regular text-v2-text-text-muted">
            Este agente está ativo no WhatsApp e processando mensagens diretamente com a Meta.
          </p>
          <div class="flex items-center gap-2 pt-1">
            <ButtonV2
              variant="outline"
              size="small"
              disabled={loadingGroups()}
              onClick={() => void loadGroups()}
            >
              {loadingGroups() ? "Carregando grupos..." : "Listar Grupos Conectados"}
            </ButtonV2>
            <ButtonV2
              variant="outline"
              size="small"
              disabled={loading()}
              onClick={() => void handleLogout()}
            >
              Desconectar Conta
            </ButtonV2>
          </div>

          <Show when={groups().length > 0}>
            <div class="mt-2 flex flex-col gap-1.5 border-t border-emerald-500/20 pt-2.5 max-h-64 overflow-y-auto pr-1">
              <span class="text-12-medium text-emerald-400">
                Selecione quais grupos este agente responderá ({groups().length} disponíveis):
              </span>
              <For each={groups()}>
                {(grp) => {
                  const isChecked = () => props.allowedGroups?.includes(grp.jid) ?? false
                  return (
                    <div
                      class={`flex items-center justify-between rounded p-2 text-12-regular border transition-all ${
                        isChecked()
                          ? "bg-emerald-950/40 border-emerald-500/40 shadow-sm"
                          : "bg-v2-background-bg-layer-02/30 border-v2-border-border-base/40 opacity-80"
                      }`}
                    >
                      <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 pr-2">
                        <input
                          type="checkbox"
                          class="rounded border-v2-border-border-base text-emerald-500 focus:ring-0"
                          checked={isChecked()}
                          onChange={(e) => props.onToggleGroup?.(grp.jid, e.currentTarget.checked)}
                        />
                        <div class="flex flex-col min-w-0">
                          <span class="truncate font-medium text-v2-text-text-base">
                            {grp.subject}
                          </span>
                          <span class="font-mono text-10-regular text-v2-text-text-muted truncate">
                            {grp.jid}
                          </span>
                        </div>
                      </label>

                      <div class="flex items-center gap-1.5 shrink-0">
                        <Show when={grp.isAdmin}>
                          <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-9-medium text-emerald-300 font-semibold border border-emerald-500/30">
                            {grp.isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
                          </span>
                        </Show>
                        <Show when={props.onConfigureGroupParticipants}>
                          <ButtonV2
                            variant="outline"
                            size="small"
                            class="text-10-medium px-2 py-0.5 h-6"
                            onClick={(e: MouseEvent) => {
                              e.preventDefault()
                              e.stopPropagation()
                              props.onConfigureGroupParticipants?.({
                                jid: grp.jid,
                                subject: grp.subject,
                                participantCount: grp.participantCount,
                              })
                            }}
                          >
                            Participantes
                          </ButtonV2>
                        </Show>
                        <span class="rounded bg-v2-background-bg-layer-02 px-1.5 py-0.5 text-10-regular text-v2-text-text-muted font-mono">
                          {grp.participantCount} membros
                        </span>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={state() !== "connected"}>
        <div class="flex flex-col items-center justify-center gap-3 py-2">
          <Show when={qrDataUrl()}>
            <div class="flex flex-col items-center gap-2">
              <div class="overflow-hidden rounded-lg border border-v2-border-border-base bg-white p-2 shadow-sm">
                <img src={qrDataUrl()!} alt="QR Code WhatsApp" class="size-52" />
              </div>
              <p class="text-11-regular text-v2-text-text-muted text-center max-w-xs">
                Abra o WhatsApp no seu celular &gt; Aparelhos conectados &gt; Conectar aparelho e escaneie o código acima.
              </p>
            </div>
          </Show>

          <div class="flex items-center gap-2">
            <ButtonV2
              variant="outline"
              size="small"
              disabled={loading() || !props.agentId}
              onClick={() => void handleConnect()}
            >
              {loading()
                ? "Conectando..."
                : qrDataUrl()
                ? "Gerar Novo QR Code"
                : "Conectar / Exibir QR Code"}
            </ButtonV2>
            <Show when={state() !== "idle" && state() !== "disconnected"}>
              <ButtonV2
                variant="outline"
                size="small"
                disabled={loading()}
                onClick={() => void handleLogout()}
              >
                Cancelar
              </ButtonV2>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
