import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Icon } from "@opencode-ai/ui/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js"
import "./settings-v2.css"

export interface ParticipantItem {
  jid: string
  name?: string
  phone?: string
  isAdmin: boolean
  isSuperAdmin: boolean
}

export const DialogIzapiaGroupParticipants: Component<{
  group: { id: string; subject: string; sessionId: string; participantCount: number }
  apiKey: string
  initialGroupSenders?: string[]
  initialGlobalSenders?: string
  onApply: (result: { groupSenders: string[]; globalSenders: string }) => void
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSDK = useServerSDK()

  const [search, setSearch] = createSignal("")
  // Modo de escopo padrão: "group" (apenas neste grupo). O usuário pode mudar para "global".
  const [scopeMode, setScopeMode] = createSignal<"group" | "global">(
    props.initialGroupSenders && props.initialGroupSenders.length > 0 ? "group" : "group"
  )

  const initialSelected = () => {
    // Se o grupo já possui participantes específicos salvos, carrega eles
    if (props.initialGroupSenders && props.initialGroupSenders.length > 0) {
      return new Set(props.initialGroupSenders)
    }
    // Caso contrário, carrega quem já estiver em globalSenders
    const tokens = (props.initialGlobalSenders ?? "")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    return new Set(tokens)
  }

  const [selectedJids, setSelectedJids] = createSignal<Set<string>>(initialSelected())
  const [filterMode, setFilterMode] = createSignal<"all" | "selected" | "admins">("all")

  const [participantsResource] = createResource(async () => {
    try {
      const res = await (serverSDK().client.whatsapp as any).izapiaGroupParticipants({
        apiKey: props.apiKey,
        sid: props.group.sessionId,
        groupId: props.group.id,
      })
      return (res.data ?? []) as ParticipantItem[]
    } catch {
      return [] as ParticipantItem[]
    }
  })

  const isSelected = (p: ParticipantItem) => {
    const set = selectedJids()
    if (set.has(p.jid)) return true
    if (p.phone && set.has(p.phone)) return true
    const cleanJid = p.jid.replace(/\D+/g, "")
    for (const item of set) {
      const cleanItem = item.replace(/\D+/g, "")
      if (cleanItem && (cleanItem === cleanJid || cleanItem === p.phone)) return true
    }
    return false
  }

  const filteredParticipants = createMemo(() => {
    let list = participantsResource() ?? []
    const mode = filterMode()
    if (mode === "selected") {
      list = list.filter((p) => isSelected(p))
    } else if (mode === "admins") {
      list = list.filter((p) => p.isAdmin || p.isSuperAdmin)
    }

    const q = search().toLowerCase().trim()
    if (!q) return list
    return list.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q)
      const jidMatch = p.jid.toLowerCase().includes(q)
      const phoneMatch = p.phone?.includes(q)
      return nameMatch || jidMatch || phoneMatch
    })
  })

  const toggleParticipant = (p: ParticipantItem, checked: boolean) => {
    const next = new Set(selectedJids())
    const key = p.phone || p.jid
    if (checked) {
      next.add(key)
    } else {
      next.delete(key)
      next.delete(p.jid)
      if (p.phone) next.delete(p.phone)
      const cleanKey = (p.phone || p.jid).replace(/\D+/g, "")
      for (const item of Array.from(next)) {
        if (item.replace(/\D+/g, "") === cleanKey) next.delete(item)
      }
    }
    setSelectedJids(next)
  }

  const selectAll = () => {
    const list = participantsResource() ?? []
    const next = new Set(selectedJids())
    for (const p of list) {
      next.add(p.phone || p.jid)
    }
    setSelectedJids(next)
  }

  const clearAll = () => {
    const list = participantsResource() ?? []
    const next = new Set(selectedJids())
    for (const p of list) {
      next.delete(p.jid)
      if (p.phone) next.delete(p.phone)
      const cleanKey = (p.phone || p.jid).replace(/\D+/g, "")
      for (const item of Array.from(next)) {
        if (item.replace(/\D+/g, "") === cleanKey) next.delete(item)
      }
    }
    setSelectedJids(next)
  }

  const handleApply = () => {
    const selectedArray = Array.from(selectedJids())
    let newGlobalSenders = props.initialGlobalSenders ?? ""

    if (scopeMode() === "global") {
      // Adiciona / atualiza os remetentes globais
      const currentList = newGlobalSenders
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const currentSet = new Set(currentList)

      // Remove do global apenas quem deste grupo foi explicitamente desmarcado
      const groupParticipants = participantsResource() ?? []
      for (const p of groupParticipants) {
        if (!isSelected(p)) {
          currentSet.delete(p.jid)
          if (p.phone) currentSet.delete(p.phone)
          const cleanKey = (p.phone || p.jid).replace(/\D+/g, "")
          for (const item of Array.from(currentSet)) {
            if (item.replace(/\D+/g, "") === cleanKey) currentSet.delete(item)
          }
        }
      }

      for (const sel of selectedArray) {
        currentSet.add(sel)
      }

      newGlobalSenders = Array.from(currentSet).join(", ")
      props.onApply({
        groupSenders: [], // limpa do grupo específico para valer o global
        globalSenders: newGlobalSenders,
      })
    } else {
      // Escopo específico deste grupo: grava diretamente no mapeamento do grupo
      props.onApply({
        groupSenders: selectedArray,
        globalSenders: newGlobalSenders,
      })
    }

    dialog.close()
  }

  return (
    <Dialog fit class="settings-v2-server-dialog max-w-[560px] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          <div class="flex items-center gap-2 truncate">
            <Icon name="folder" size="small" class="text-v2-primary-primary-base shrink-0" />
            <span class="truncate">
              {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.title", {
                subject: props.group.subject,
              })}
            </span>
          </div>
        </DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col gap-3 px-4 pt-3 pb-2">
        <p class="text-11-regular text-v2-text-text-muted">
          {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.hint")}
        </p>

        {/* Escolha do Escopo de Permissão */}
        <div class="flex flex-col gap-1.5 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-01/40 p-3">
          <span class="text-11-medium uppercase text-v2-text-text-muted">Escopo da Permissão</span>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer text-12-medium text-v2-text-text-base">
              <input
                type="radio"
                name="scopeMode"
                checked={scopeMode() === "group"}
                onChange={() => setScopeMode("group")}
                class="text-v2-primary-primary-base"
              />
              <span>Apenas neste grupo ({props.group.subject})</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-12-medium text-v2-text-text-base">
              <input
                type="radio"
                name="scopeMode"
                checked={scopeMode() === "global"}
                onChange={() => setScopeMode("global")}
                class="text-v2-primary-primary-base"
              />
              <span>Globalmente (qualquer grupo ou direct)</span>
            </label>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex-1">
            <TextInputV2
              placeholder={language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.searchPlaceholder")}
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
          </div>
          <ButtonV2 variant="outline" size="small" onClick={selectAll}>
            {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.selectAll")}
          </ButtonV2>
          <ButtonV2 variant="outline" size="small" onClick={clearAll}>
            {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.clearAll")}
          </ButtonV2>
        </div>

        <div class="flex items-center gap-1.5 border-b border-v2-border-border-base/50 pb-2">
          <button
            type="button"
            class={`px-2.5 py-1 text-11-medium rounded transition-colors ${
              filterMode() === "all"
                ? "bg-v2-surface-surface-base text-v2-text-text-base border border-v2-border-border-base"
                : "text-v2-text-text-muted hover:text-v2-text-text-base"
            }`}
            onClick={() => setFilterMode("all")}
          >
            Todos ({participantsResource()?.length ?? 0})
          </button>
          <button
            type="button"
            class={`px-2.5 py-1 text-11-medium rounded transition-colors ${
              filterMode() === "selected"
                ? "bg-v2-surface-surface-base text-v2-text-text-base border border-v2-border-border-base"
                : "text-v2-text-text-muted hover:text-v2-text-text-base"
            }`}
            onClick={() => setFilterMode("selected")}
          >
            Selecionados ({selectedJids().size})
          </button>
          <button
            type="button"
            class={`px-2.5 py-1 text-11-medium rounded transition-colors ${
              filterMode() === "admins"
                ? "bg-v2-surface-surface-base text-v2-text-text-base border border-v2-border-border-base"
                : "text-v2-text-text-muted hover:text-v2-text-text-base"
            }`}
            onClick={() => setFilterMode("admins")}
          >
            Admins
          </button>
        </div>

        <ScrollView class="max-h-[380px] min-h-[160px] w-full rounded-md border border-v2-border-border-base bg-v2-background-bg-layer-01/30 p-2">
          <Show
            when={!participantsResource.loading}
            fallback={
              <div class="flex items-center justify-center p-8 text-13-regular text-v2-text-text-muted">
                {language.t("common.loading")}
              </div>
            }
          >
            <Show
              when={filteredParticipants().length > 0}
              fallback={
                <div class="flex items-center justify-center p-8 text-12-regular text-v2-text-text-muted">
                  {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.empty")}
                </div>
              }
            >
              <div class="flex flex-col gap-1.5">
                <For each={filteredParticipants()}>
                  {(participant) => {
                    const checked = () => isSelected(participant)
                    return (
                      <label
                        class={`
                          flex cursor-pointer items-center justify-between gap-3 rounded-lg border
                          px-3 py-2 text-13-regular transition-colors
                          ${
                            checked()
                              ? "border-v2-border-border-focus bg-v2-background-bg-layer-01 shadow-sm"
                              : "border-v2-border-border-base bg-v2-surface-surface-raised/40 hover:bg-v2-background-bg-layer-01"
                          }
                        `}
                      >
                        <span class="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            class="rounded border-v2-border-border-base text-v2-primary-primary-base focus:ring-1 focus:ring-v2-border-border-focus"
                            checked={checked()}
                            onChange={(e) => toggleParticipant(participant, e.currentTarget.checked)}
                          />
                          <div class="flex flex-col min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="truncate font-medium text-v2-text-text-base">
                                {participant.name || participant.phone || participant.jid}
                              </span>
                              <Show when={participant.isAdmin || participant.isSuperAdmin}>
                                <span class="rounded bg-v2-primary-primary-base/15 text-v2-primary-primary-base px-1.5 py-0.2 text-10-medium uppercase">
                                  {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.admin")}
                                </span>
                              </Show>
                            </div>
                            <span class="truncate text-11-regular font-mono text-v2-text-text-muted">
                              {participant.phone || participant.jid}
                            </span>
                          </div>
                        </span>
                      </label>
                    )
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </ScrollView>
      </DialogBody>
      <DividerV2 />
      <DialogFooter>
        <span class="text-11-regular text-v2-text-text-muted mr-auto">
          {selectedJids().size} selecionado(s) {scopeMode() === "group" ? `para o grupo ${props.group.subject}` : "globalmente"}
        </span>
        <ButtonV2 variant="neutral" size="small" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2 variant="contrast" size="small" onClick={handleApply}>
          {language.t("settings.agentui.field.whatsapp.izapiaGroups.participantsDialog.apply")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
