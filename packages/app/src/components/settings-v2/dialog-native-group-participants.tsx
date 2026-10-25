import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@allcode/ui/v2/dialog-v2"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { DividerV2 } from "@allcode/ui/v2/divider-v2"
import { TextInputV2 } from "@allcode/ui/v2/text-input-v2"
import { ScrollView } from "@allcode/ui/scroll-view"
import { useDialog } from "@allcode/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js"
import "./settings-v2.css"

export interface NativeParticipantItem {
  jid: string
  name?: string
  phone?: string
  isAdmin: boolean
  isSuperAdmin: boolean
}

export const DialogNativeGroupParticipants: Component<{
  agentId: string
  group: { jid: string; subject: string; participantCount: number }
  initialGroupSenders?: string[]
  initialGlobalSenders?: string
  onApply: (result: { groupSenders: string[]; globalSenders: string }) => void
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const server = useServer()

  const [search, setSearch] = createSignal("")
  const [scopeMode, setScopeMode] = createSignal<"group" | "global">(
    props.initialGroupSenders && props.initialGroupSenders.length > 0 ? "group" : "group",
  )

  const initialSelected = () => {
    if (props.initialGroupSenders && props.initialGroupSenders.length > 0) {
      return new Set(props.initialGroupSenders)
    }
    const tokens = (props.initialGlobalSenders ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    return new Set(tokens)
  }

  const [selectedJids, setSelectedJids] = createSignal<Set<string>>(initialSelected())
  const [filterMode, setFilterMode] = createSignal<"all" | "selected" | "admins">("all")

  const baseUrl = () => server.current?.http.url?.replace(/\/$/, "") ?? ""

  const [participantsResource] = createResource(async () => {
    try {
      const res = await fetch(
        `${baseUrl()}/whatsapp/native/${props.agentId}/groups/${encodeURIComponent(props.group.jid)}/participants`,
        {
          headers: {
            ...(server.current?.http.username && server.current?.http.password
              ? {
                  Authorization: `Basic ${btoa(
                    `${server.current.http.username}:${server.current.http.password}`,
                  )}`,
                }
              : {}),
          },
        },
      )
      if (res.ok) {
        const data = await res.json()
        return (Array.isArray(data) ? data : []) as NativeParticipantItem[]
      }
      return [] as NativeParticipantItem[]
    } catch {
      return [] as NativeParticipantItem[]
    }
  })

  const isSelected = (p: NativeParticipantItem) => {
    const set = selectedJids()
    if (set.has(p.jid)) return true
    if (p.phone && set.has(p.phone)) return true
    return false
  }

  const toggleParticipant = (p: NativeParticipantItem) => {
    const key = p.phone || p.jid
    setSelectedJids((prev) => {
      const next = new Set(prev)
      if (next.has(key) || next.has(p.jid)) {
        next.delete(key)
        next.delete(p.jid)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAllAdmins = () => {
    const list = participantsResource() ?? []
    setSelectedJids((prev) => {
      const next = new Set(prev)
      for (const p of list) {
        if (p.isAdmin || p.isSuperAdmin) {
          next.add(p.phone || p.jid)
        }
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedJids(new Set<string>())
  }

  const filteredParticipants = createMemo(() => {
    const list = participantsResource() ?? []
    const q = search().toLowerCase().trim()
    const mode = filterMode()

    return list.filter((p) => {
      if (mode === "selected" && !isSelected(p)) return false
      if (mode === "admins" && !p.isAdmin && !p.isSuperAdmin) return false

      if (!q) return true
      const nameMatch = p.name?.toLowerCase().includes(q)
      const phoneMatch = p.phone?.includes(q)
      const jidMatch = p.jid.toLowerCase().includes(q)
      return Boolean(nameMatch || phoneMatch || jidMatch)
    })
  })

  const selectedCount = createMemo(() => {
    const list = participantsResource() ?? []
    return list.filter(isSelected).length
  })

  const handleApply = () => {
    const items = Array.from(selectedJids())
    if (scopeMode() === "group") {
      props.onApply({
        groupSenders: items,
        globalSenders: props.initialGlobalSenders ?? "",
      })
    } else {
      const existing = (props.initialGlobalSenders ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const merged = Array.from(new Set([...existing, ...items]))
      props.onApply({
        groupSenders: [],
        globalSenders: merged.join(", "),
      })
    }
    dialog.close()
  }

  return (
    <Dialog fit class="settings-v2-server-dialog max-w-[560px] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          <div class="flex items-center gap-2 truncate">
            <span class="truncate">
              Participantes autorizados: {props.group.subject}
            </span>
          </div>
        </DialogTitle>
      </DialogHeader>
      <DividerV2 />

      <DialogBody class="flex w-full min-w-0 flex-1 flex-col gap-3 px-4 pt-3 pb-2">
        <span class="text-11-regular text-v2-text-text-muted">
          Defina quais membros deste grupo têm permissão para interagir com o agente.
        </span>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <TextInputV2
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Buscar por nome, telefone ou JID..."
            />
          </div>
          <ButtonV2 variant="outline" size="small" onClick={selectAllAdmins}>
            Marcar Administradores
          </ButtonV2>
          <Show when={selectedJids().size > 0}>
            <ButtonV2 variant="ghost" size="small" onClick={clearSelection}>
              Limpar
            </ButtonV2>
          </Show>
        </div>

        <div class="flex items-center justify-between border-b border-v2-border-border-base/50 pb-2">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class={`rounded px-2.5 py-1 text-11-medium transition-colors ${
                filterMode() === "all"
                  ? "bg-v2-background-bg-layer-02 text-v2-text-text-base"
                  : "text-v2-text-text-muted hover:text-v2-text-text-base"
              }`}
              onClick={() => setFilterMode("all")}
            >
              Todos ({participantsResource()?.length ?? 0})
            </button>
            <button
              type="button"
              class={`rounded px-2.5 py-1 text-11-medium transition-colors ${
                filterMode() === "selected"
                  ? "bg-v2-background-bg-layer-02 text-v2-text-text-base"
                  : "text-v2-text-text-muted hover:text-v2-text-text-base"
              }`}
              onClick={() => setFilterMode("selected")}
            >
              Selecionados ({selectedCount()})
            </button>
            <button
              type="button"
              class={`rounded px-2.5 py-1 text-11-medium transition-colors ${
                filterMode() === "admins"
                  ? "bg-v2-background-bg-layer-02 text-v2-text-text-base"
                  : "text-v2-text-text-muted hover:text-v2-text-text-base"
              }`}
              onClick={() => setFilterMode("admins")}
            >
              Admins
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-11-regular text-v2-text-text-muted">Aplicar como:</span>
            <select
              class="h-7 rounded border border-v2-border-border-base bg-v2-background-bg-base px-2 text-11-medium text-v2-text-text-base"
              value={scopeMode()}
              onChange={(e) => setScopeMode(e.currentTarget.value as any)}
            >
              <option value="group">Apenas neste grupo</option>
              <option value="global">Global (em qualquer grupo ou DM)</option>
            </select>
          </div>
        </div>

        <div class="h-80 overflow-hidden rounded-md border border-v2-border-border-base bg-v2-background-bg-layer-01/30">
          <Show
            when={!participantsResource.loading}
            fallback={
              <div class="flex h-full items-center justify-center text-12-regular text-v2-text-text-muted">
                Carregando membros do grupo...
              </div>
            }
          >
            <ScrollView class="h-full p-1">
              <Show
                when={filteredParticipants().length > 0}
                fallback={
                  <div class="flex h-48 items-center justify-center text-12-regular text-v2-text-text-muted">
                    Nenhum participante encontrado
                  </div>
                }
              >
                <div class="flex flex-col gap-1">
                  <For each={filteredParticipants()}>
                    {(p) => {
                      const checked = () => isSelected(p)
                      return (
                        <div
                          class={`flex cursor-pointer items-center justify-between rounded p-2 text-12-regular transition-colors ${
                            checked()
                              ? "bg-emerald-500/15 border border-emerald-500/30"
                              : "hover:bg-v2-background-bg-layer-02/50 border border-transparent"
                          }`}
                          onClick={() => toggleParticipant(p)}
                        >
                          <div class="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              class="rounded border-v2-border-border-base text-emerald-500 focus:ring-0"
                              checked={checked()}
                              onChange={() => toggleParticipant(p)}
                            />
                            <div class="flex flex-col min-w-0">
                              <span class="truncate font-medium text-v2-text-text-base">
                                {p.name || p.phone}
                              </span>
                              <span class="font-mono text-10-regular text-v2-text-text-muted truncate">
                                +{p.phone}
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <Show when={p.isAdmin}>
                              <span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-9-medium text-emerald-300 font-semibold border border-emerald-500/30">
                                {p.isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
                              </span>
                            </Show>
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </Show>
            </ScrollView>
          </Show>
        </div>
      </DialogBody>

      <DividerV2 />

      <DialogFooter>
        <div class="flex w-full items-center justify-between">
          <span class="text-11-regular text-v2-text-text-muted">
            {selectedCount()} membro(s) selecionado(s)
          </span>
          <div class="flex items-center gap-2">
            <ButtonV2 variant="ghost" size="small" onClick={() => dialog.close()}>
              Cancelar
            </ButtonV2>
            <ButtonV2 variant="outline" size="small" onClick={handleApply}>
              Aplicar Seleção
            </ButtonV2>
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
