import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Icon } from "@opencode-ai/ui/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { createResource, createSignal, For, Show, type Component } from "solid-js"
import "./settings-v2.css"

export const DialogAgentUIDiagnose: Component<{
  agentID: string
  agentName: string
  directory?: string
  onOpenSandbox?: () => void
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSDK = useServerSDK()

  const [diagnose, { refetch }] = createResource(async () => {
    const result = await serverSDK().client.agentui.diagnose({ id: props.agentID })
    return result.data
  })

  return (
    <Dialog fit class="settings-v2-server-dialog max-w-[540px] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          <div class="flex items-center gap-2">
            <Icon name="status-active" size="small" class="text-v2-text-text-accent" />
            <span>{language.t("settings.agentui.diagnose.title", { name: props.agentName })}</span>
          </div>
        </DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col gap-3 px-4 pt-4 pb-2">
        <div class="flex items-center justify-between">
          <p class="text-11-regular text-v2-text-text-muted">
            {language.t("settings.agentui.diagnose.description")}
          </p>
          <ButtonV2
            variant="outline"
            size="small"
            disabled={diagnose.loading}
            onClick={() => void refetch()}
          >
            {diagnose.loading ? language.t("common.loading") : language.t("common.refresh")}
          </ButtonV2>
        </div>

        <ScrollView class="max-h-[360px] min-h-[140px] w-full rounded-md border border-v2-border-border-base bg-v2-background-bg-layer-01/30 p-2">
          <Show
            when={!diagnose.loading}
            fallback={
              <div class="flex items-center justify-center p-6 text-13-regular text-v2-text-text-muted">
                {language.t("common.loading")}
              </div>
            }
          >
            <div class="flex flex-col gap-2">
              <For each={diagnose()?.items ?? []}>
                {(item) => (
                  <div class="flex flex-col gap-1 rounded-lg border border-v2-border-border-base bg-v2-background-bg-base p-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-13-medium text-v2-text-text-base">{item.name}</span>
                      <span
                        class="flex items-center gap-1.5 rounded px-2 py-0.5 text-11-medium"
                        classList={{
                          "bg-v2-state-bg-success text-v2-state-fg-success": item.status === "ok",
                          "bg-v2-state-bg-warning text-v2-state-fg-warning": item.status === "warning",
                          "bg-v2-state-bg-danger text-v2-state-fg-danger": item.status === "error",
                        }}
                      >
                        <span
                          class="size-1.5 rounded-full"
                          classList={{
                            "bg-v2-state-fg-success": item.status === "ok",
                            "bg-v2-state-fg-warning": item.status === "warning",
                            "bg-v2-state-fg-danger": item.status === "error",
                          }}
                        />
                        {item.status === "ok"
                          ? language.t("settings.agentui.diagnose.status.ok")
                          : item.status === "warning"
                            ? language.t("settings.agentui.diagnose.status.warning")
                            : language.t("settings.agentui.diagnose.status.error")}
                      </span>
                    </div>
                    <p class="text-12-regular text-v2-text-text-muted">{item.message}</p>
                    <Show when={item.details}>
                      <span class="text-11-regular font-mono text-v2-text-text-faint break-all bg-v2-background-bg-layer-01 rounded px-1.5 py-0.5 mt-0.5">
                        {item.details}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </ScrollView>
      </DialogBody>
      <DialogFooter>
        <Show when={props.onOpenSandbox}>
          <ButtonV2
            variant="contrast"
            onClick={() => {
              dialog.close()
              props.onOpenSandbox?.()
            }}
          >
            {language.t("settings.agentui.sandbox.open")}
          </ButtonV2>
        </Show>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("common.close")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
