import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { DialogBody, DialogFooter } from "@allcode/ui/v2/dialog-v2"
import { Icon } from "@allcode/ui/icon"
import { Switch as SwitchV2 } from "@allcode/ui/v2/switch-v2"
import { TextInputV2 } from "@allcode/ui/v2/text-input-v2"
import type { MailAccountSummary, MailTestResult } from "@allcode/sdk/v2/types"
import { useMutation } from "@tanstack/solid-query"
import { createSignal, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import {
  detectProviderPreset,
  inferProviderTag,
  providerFields,
  providerPreset,
  type MailProviderID,
} from "./mail-account-presets"
import { MailAccountProviderPicker } from "./mail-account-provider-picker"

type FormError = Partial<Record<"label" | "host" | "user" | "appPassword" | "smtpHost", string>>

export const MailAccountForm: Component<{
  account?: MailAccountSummary
  onCancel: () => void
  onSaved: () => void
}> = (props) => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const [result, setResult] = createSignal<MailTestResult>()
  const [showDebug, setShowDebug] = createSignal(false)
  const [showAdvanced, setShowAdvanced] = createSignal(Boolean(props.account?.sentFolder))
  let formRef: HTMLFormElement | undefined

  const [form, setForm] = createStore({
    selected: detectProviderPreset(props.account ?? { provider: "", host: "" }) as MailProviderID | undefined,
    provider: props.account?.provider ?? "",
    label: props.account?.label ?? "",
    id: props.account?.id ?? "",
    host: props.account?.host ?? "",
    port: String(props.account?.port ?? 993),
    secure: props.account?.secure ?? true,
    user: props.account?.user ?? "",
    appPassword: "",
    smtpEnabled: Boolean(props.account?.smtp),
    smtpHost: props.account?.smtp?.host ?? "",
    smtpPort: String(props.account?.smtp?.port ?? 587),
    smtpSecure: props.account?.smtp?.secure ?? false,
    sentFolder: props.account?.sentFolder ?? "",
    err: {} as FormError,
  })

  const selectProvider = (id: MailProviderID) => {
    const preset = providerPreset(id)
    if (!preset) return
    setForm({ selected: id, provider: preset.tag, ...providerFields(preset), err: {} })
    setResult(undefined)
  }

  const validate = () => {
    const label = form.label.trim()
    const host = form.host.trim()
    const user = form.user.trim()
    const appPassword = form.appPassword.trim()
    const smtpHost = form.smtpHost.trim()
    const required = language.t("provider.custom.error.required")
    const err: FormError = {
      label: !label ? required : undefined,
      host: !host ? required : undefined,
      user: !user ? required : undefined,
      appPassword: !appPassword ? required : undefined,
      smtpHost: form.smtpEnabled && !smtpHost ? language.t("settings.mcp.mail.field.smtpHost.required") : undefined,
    }
    setForm("err", err)
    if (err.label || err.host || err.user || err.appPassword || err.smtpHost) {
      queueMicrotask(() => formRef?.querySelector<HTMLElement>("[data-invalid] input")?.focus())
      return
    }
    return {
      id: form.id.trim() || user.toLowerCase(),
      label,
      provider: form.provider.trim() || inferProviderTag(host),
      host,
      port: Math.max(1, Number(form.port) || 993),
      secure: form.secure,
      user,
      appPassword,
      smtp: form.smtpEnabled
        ? { host: smtpHost, port: Math.max(1, Number(form.smtpPort) || 587), secure: form.smtpSecure }
        : undefined,
      sentFolder: form.sentFolder.trim() || undefined,
    }
  }

  const testMutation = useMutation(() => ({
    mutationFn: async (input: NonNullable<ReturnType<typeof validate>>) => {
      const response = await serverSDK().client.mailAccounts.test(input)
      return response.data
    },
    onSuccess: (data) => {
      if (!data) return
      setResult(data)
      if (data.ok) {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("settings.mcp.mail.test.success"),
          description: data.imap.message,
        })
        return
      }
      const errors = [
        !data.imap.ok ? `IMAP: ${data.imap.message}` : undefined,
        data.smtp && !data.smtp.ok ? `SMTP: ${data.smtp.message}` : undefined,
      ].filter(Boolean)
      showToast({ title: language.t("settings.mcp.mail.test.failed"), description: errors.join(" — ") })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err)
      showToast({ title: language.t("common.requestFailed"), description: message })
    },
  }))

  const saveMutation = useMutation(() => ({
    mutationFn: async (input: NonNullable<ReturnType<typeof validate>>) => {
      await serverSDK().client.mailAccounts.add(input)
      // The id is the key of the stored account, so renaming it recreates the account.
      if (props.account && props.account.id !== input.id) {
        await serverSDK().client.mailAccounts.remove({ id: props.account.id })
      }
    },
    onSuccess: () => {
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.mcp.mail.toast.saved") })
      props.onSaved()
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err)
      showToast({ title: language.t("common.requestFailed"), description: message })
    },
  }))

  const busy = () => saveMutation.isPending || testMutation.isPending

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (busy()) return
    const input = validate()
    if (input) saveMutation.mutate(input)
  }

  const test = () => {
    if (busy()) return
    const input = validate()
    if (input) testMutation.mutate(input)
  }

  return (
    <>
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col overflow-y-auto">
        <form
          id="settings-mail-account-form"
          ref={formRef}
          class="flex w-full min-w-0 flex-col gap-5 px-6 py-5"
          onSubmit={submit}
        >
          <MailAccountProviderPicker selected={form.selected} onSelect={selectProvider} />

          <div class="flex w-full min-w-0 flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.name")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full self-stretch"
              value={form.label}
              placeholder={language.t("settings.mcp.mail.field.name.placeholder")}
              invalid={!!form.err.label}
              autofocus
              onInput={(event) => setForm("label", event.currentTarget.value)}
            />
            <Show when={form.err.label}>
              <span class="settings-v2-server-dialog-error">{form.err.label}</span>
            </Show>
          </div>

          <div class="flex w-full min-w-0 gap-3">
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.host")}</label>
              <TextInputV2
                type="text"
                appearance="large"
                class="!w-full self-stretch"
                value={form.host}
                placeholder={language.t("settings.mcp.mail.field.host.placeholder")}
                invalid={!!form.err.host}
                onInput={(event) => setForm("host", event.currentTarget.value)}
              />
              <Show when={form.err.host}>
                <span class="settings-v2-server-dialog-error">{form.err.host}</span>
              </Show>
            </div>
            <div class="flex w-[96px] flex-col gap-2">
              <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.port")}</label>
              <TextInputV2
                type="text"
                inputmode="numeric"
                appearance="large"
                class="!w-full self-stretch"
                value={form.port}
                onInput={(event) => setForm("port", event.currentTarget.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <label class="flex items-center gap-2 text-12-regular text-text-weak">
            <SwitchV2 checked={form.secure} onChange={(checked) => setForm("secure", checked)} />
            {language.t("settings.mcp.mail.field.secure")}
          </label>

          <div class="flex w-full min-w-0 flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.user")}</label>
            <TextInputV2
              type="text"
              appearance="large"
              class="!w-full self-stretch"
              value={form.user}
              placeholder={language.t("settings.mcp.mail.field.user.placeholder")}
              invalid={!!form.err.user}
              onInput={(event) => setForm("user", event.currentTarget.value)}
            />
            <Show when={form.err.user}>
              <span class="settings-v2-server-dialog-error">{form.err.user}</span>
            </Show>
          </div>

          <div class="flex w-full min-w-0 flex-col gap-2">
            <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.password")}</label>
            <TextInputV2
              type="password"
              appearance="large"
              class="!w-full self-stretch"
              value={form.appPassword}
              placeholder={language.t("settings.mcp.mail.field.password.placeholder")}
              invalid={!!form.err.appPassword}
              onInput={(event) => setForm("appPassword", event.currentTarget.value)}
            />
            <Show when={form.err.appPassword}>
              <span class="settings-v2-server-dialog-error">{form.err.appPassword}</span>
            </Show>
            <Show when={props.account}>
              <span class="settings-v2-server-dialog-hint">
                {language.t("settings.mcp.mail.field.password.editHint")}
              </span>
            </Show>
          </div>

          <div class="flex w-full min-w-0 flex-col gap-3">
            <label class="flex items-center gap-2 text-12-regular font-medium text-text-base">
              <SwitchV2 checked={form.smtpEnabled} onChange={(checked) => setForm("smtpEnabled", checked)} />
              {language.t("settings.mcp.mail.field.smtp")}
            </label>
            <Show when={form.smtpEnabled}>
              <div class="flex flex-col gap-3 rounded-md border border-v2-border-border-muted bg-v2-background-bg-layer-02 p-3">
                <div class="flex w-full min-w-0 gap-3">
                  <div class="flex min-w-0 flex-1 flex-col gap-2">
                    <label class="settings-v2-server-dialog-label">
                      {language.t("settings.mcp.mail.field.smtpHost")}
                    </label>
                    <TextInputV2
                      type="text"
                      appearance="large"
                      class="!w-full self-stretch"
                      value={form.smtpHost}
                      placeholder={language.t("settings.mcp.mail.field.host.placeholder")}
                      invalid={!!form.err.smtpHost}
                      onInput={(event) => setForm("smtpHost", event.currentTarget.value)}
                    />
                    <Show when={form.err.smtpHost}>
                      <span class="settings-v2-server-dialog-error">{form.err.smtpHost}</span>
                    </Show>
                  </div>
                  <div class="flex w-[96px] flex-col gap-2">
                    <label class="settings-v2-server-dialog-label">
                      {language.t("settings.mcp.mail.field.port")}
                    </label>
                    <TextInputV2
                      type="text"
                      inputmode="numeric"
                      appearance="large"
                      class="!w-full self-stretch"
                      value={form.smtpPort}
                      onInput={(event) => {
                        const port = event.currentTarget.value.replace(/\D/g, "")
                        setForm("smtpPort", port)
                        if (port === "465") setForm("smtpSecure", true)
                        else if (port === "587") setForm("smtpSecure", false)
                      }}
                    />
                  </div>
                </div>
                <label class="flex items-center gap-2 text-12-regular text-text-weak">
                  <SwitchV2 checked={form.smtpSecure} onChange={(checked) => setForm("smtpSecure", checked)} />
                  {language.t("settings.mcp.mail.field.smtpSecure")}
                </label>
              </div>
            </Show>
          </div>

          <div class="flex flex-col gap-4 border-t border-v2-border-border-muted pt-4">
            <button
              type="button"
              class="flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-12-medium text-text-interactive hover:underline"
              aria-expanded={showAdvanced()}
              onClick={() => setShowAdvanced(!showAdvanced())}
            >
              <Icon name={showAdvanced() ? "chevron-down" : "chevron-right"} size="small" />
              <span>{language.t("settings.mcp.mail.section.advanced")}</span>
            </button>

            <Show when={showAdvanced()}>
              <div class="flex flex-col gap-5">
                <div class="flex w-full min-w-0 flex-col gap-2">
                  <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.field.id")}</label>
                  <TextInputV2
                    type="text"
                    appearance="large"
                    class="!w-full self-stretch"
                    value={form.id}
                    placeholder={language.t("settings.mcp.mail.field.id.placeholder")}
                    onInput={(event) => setForm("id", event.currentTarget.value)}
                  />
                  <span class="settings-v2-server-dialog-hint">
                    {props.account
                      ? language.t("settings.mcp.mail.field.id.hint.edit")
                      : language.t("settings.mcp.mail.field.id.hint")}
                  </span>
                </div>

                <div class="flex w-full min-w-0 flex-col gap-2">
                  <label class="settings-v2-server-dialog-label">
                    {language.t("settings.mcp.mail.field.sentFolder")}
                  </label>
                  <TextInputV2
                    type="text"
                    appearance="large"
                    class="!w-full self-stretch"
                    value={form.sentFolder}
                    placeholder={language.t("settings.mcp.mail.field.sentFolder.placeholder")}
                    onInput={(event) => setForm("sentFolder", event.currentTarget.value)}
                  />
                  <span class="settings-v2-server-dialog-hint">
                    {language.t("settings.mcp.mail.field.sentFolder.hint")}
                  </span>
                </div>

                <div class="flex flex-col gap-2">
                  <label class="flex cursor-pointer select-none items-center justify-between text-12-regular text-text-weak">
                    <span class="font-medium text-text-base">{language.t("settings.mcp.mail.debug")}</span>
                    <SwitchV2 checked={showDebug()} onChange={(checked) => setShowDebug(checked)} />
                  </label>
                  <Show when={showDebug()}>
                    <div class="flex max-h-[160px] flex-col gap-1 overflow-y-auto whitespace-pre-wrap break-all rounded border border-v2-border-border-muted bg-v2-background-bg-layer-02 p-2.5 font-mono text-11-regular text-text-weak">
                      <Show when={result()} fallback={<span>{language.t("settings.mcp.mail.debug.empty")}</span>}>
                        {(value) => (
                          <>
                            <span>
                              {`IMAP: ${value().imap.ok ? language.t("settings.mcp.mail.test.success") : language.t("settings.mcp.mail.test.failed")} — ${value().imap.message}`}
                            </span>
                            <Show when={value().imap.log}>{(log) => <span>{log()}</span>}</Show>
                            <Show when={value().smtp}>
                              {(smtp) => (
                                <>
                                  <span>
                                    {`SMTP: ${smtp().ok ? language.t("settings.mcp.mail.test.success") : language.t("settings.mcp.mail.test.failed")} — ${smtp().message}`}
                                  </span>
                                  <Show when={smtp().log}>{(log) => <span>{log()}</span>}</Show>
                                </>
                              )}
                            </Show>
                          </>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </form>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="neutral" disabled={busy()} onClick={props.onCancel}>
          {language.t("common.cancel")}
        </ButtonV2>
        <div class="flex items-center gap-2">
          <ButtonV2 variant="neutral" disabled={busy()} onClick={test}>
            {testMutation.isPending ? language.t("common.loading") : language.t("settings.mcp.mail.test")}
          </ButtonV2>
          <ButtonV2 variant="contrast" type="submit" form="settings-mail-account-form" disabled={busy()}>
            {saveMutation.isPending
              ? language.t("common.loading")
              : props.account
                ? language.t("settings.mcp.mail.save")
                : language.t("settings.mcp.mail.add")}
          </ButtonV2>
        </div>
      </DialogFooter>
    </>
  )
}
