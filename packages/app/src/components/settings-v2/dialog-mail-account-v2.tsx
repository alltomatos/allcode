import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@allcode/ui/v2/dialog-v2"
import { DividerV2 } from "@allcode/ui/v2/divider-v2"
import { Icon } from "@allcode/ui/icon"
import { IconButtonV2 } from "@allcode/ui/v2/icon-button-v2"
import { useDialog } from "@allcode/ui/context/dialog"
import { useMutation } from "@tanstack/solid-query"
import { createResource, createSignal, For, Show, type Component } from "solid-js"
import type { MailAccountSummary } from "@allcode/sdk/v2/types"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { MailAccountForm } from "./mail-account-form"
import "./settings-v2.css"

export const DialogMailAccountV2: Component<{ onAdded?: () => void }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const [editor, setEditor] = createSignal<{ account?: MailAccountSummary }>()

  const [accounts, { refetch }] = createResource(async () => {
    const result = await serverSDK().client.mailAccounts.list()
    return result.data ?? []
  })

  const removeMutation = useMutation(() => ({
    mutationFn: async (id: string) => {
      await serverSDK().client.mailAccounts.remove({ id })
    },
    onSuccess: () => {
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.mcp.mail.toast.removed") })
      void refetch()
      props.onAdded?.()
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err)
      showToast({ title: language.t("common.requestFailed"), description: message })
    },
  }))

  const confirmRemove = (account: MailAccountSummary) => {
    dialog.push(() => (
      <Dialog fit>
        <DialogHeader hideClose={true}>
          <DialogTitle>{language.t("settings.mcp.mail.remove.confirm.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody class="px-4 pt-2 pb-4">
          <span class="text-13-regular text-text-weak">
            {language.t("settings.mcp.mail.remove.confirm.description", { name: account.label })}
          </span>
        </DialogBody>
        <DialogFooter>
          <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2
            variant="danger"
            onClick={() => {
              dialog.close()
              removeMutation.mutate(account.id)
            }}
          >
            {language.t("common.remove")}
          </ButtonV2>
        </DialogFooter>
      </Dialog>
    ))
  }

  return (
    <Dialog fit class="settings-v2-mail-dialog">
      <DialogHeader>
        <DialogTitle>
          {editor()?.account
            ? language.t("settings.mcp.mail.edit.title")
            : editor()
              ? language.t("settings.mcp.mail.add.title")
              : language.t("settings.mcp.mail.title")}
        </DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <Show
        when={editor()}
        keyed
        fallback={
          <>
            <DialogBody class="flex w-full min-w-0 flex-1 flex-col overflow-y-auto">
              <div class="flex w-full min-w-0 flex-col gap-4 px-6 py-5">
                <p class="text-12-regular text-text-weak">{language.t("settings.mcp.mail.subtitle")}</p>
                <div class="flex w-full min-w-0 flex-col gap-2">
                  <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.connected")}</label>
                  <Show
                    when={(accounts() ?? []).length > 0}
                    fallback={<span class="settings-v2-server-dialog-hint">{language.t("settings.mcp.mail.empty")}</span>}
                  >
                    <div class="flex flex-col gap-1.5">
                      <For each={accounts()}>
                        {(account) => (
                          <div class="flex items-center justify-between gap-2 rounded-md bg-v2-background-bg-layer-01 px-2.5 py-1.5">
                            <div class="flex min-w-0 flex-col">
                              <span class="truncate text-13-regular">{account.label}</span>
                              <span class="truncate text-11-regular text-text-weak">
                                {account.user} · {account.host}
                              </span>
                            </div>
                            <div class="flex items-center gap-1">
                              <IconButtonV2
                                variant="ghost-muted"
                                aria-label={language.t("common.edit")}
                                onClick={() => setEditor({ account })}
                                icon={<Icon name="edit" size="small" />}
                              />
                              <IconButtonV2
                                variant="ghost-muted"
                                class="hover:text-v2-state-fg-danger focus-visible:text-v2-state-fg-danger"
                                aria-label={language.t("common.remove")}
                                onClick={() => confirmRemove(account)}
                                icon={<Icon name="trash" size="small" />}
                              />
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <div class="flex w-full items-center justify-between">
                <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
                  {language.t("common.close")}
                </ButtonV2>
                <ButtonV2 variant="contrast" icon="plus" onClick={() => setEditor({})}>
                  {language.t("settings.mcp.mail.add")}
                </ButtonV2>
              </div>
            </DialogFooter>
          </>
        }
      >
        {(state) => (
          <MailAccountForm
            account={state.account}
            onCancel={() => setEditor(undefined)}
            onSaved={() => {
              setEditor(undefined)
              void refetch()
              props.onAdded?.()
            }}
          />
        )}
      </Show>
    </Dialog>
  )
}
