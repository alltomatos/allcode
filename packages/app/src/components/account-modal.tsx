import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { useLanguage } from "@/context/language"
import { useTenantAuth } from "@/context/tenant-auth"
import { Icon as IconV2 } from "@allcode/ui/v2/icon"
import { showToast } from "@/utils/toast"

const DEFAULT_AUTH_URL = "https://allcode.alltomatos.dev.br"
const MIN_PASSWORD_LENGTH = 8
const BRAND = "#0f9d6e"

type View = "menu" | "password"

export function AccountModal(props: { onClose: () => void }) {
  const language = useLanguage()
  const tenantAuth = useTenantAuth()

  const [view, setView] = createSignal<View>("menu")
  const [current, setCurrent] = createSignal("")
  const [next, setNext] = createSignal("")
  const [confirm, setConfirm] = createSignal("")
  const [reveal, setReveal] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [saving, setSaving] = createSignal(false)

  const user = () => tenantAuth.store.user
  const tenant = () => tenantAuth.store.tenant
  const initials = () => (user()?.name || user()?.email || "?").slice(0, 2).toUpperCase()

  const planLabel = createMemo(() => {
    const current = tenant()
    if (!current) return language.t("account.plan.none")
    if (current.plan?.name) return current.plan.name
    if (current.planType === "trial") return language.t("account.plan.trial")
    if (current.planType === "paid") return language.t("account.plan.paid")
    return language.t("account.plan.none")
  })
  const showPlan = createMemo(() => Boolean(tenant()?.plan || tenant()?.planType))

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    if (view() === "password") {
      setView("menu")
      return
    }
    props.onClose()
  }

  onMount(() => document.addEventListener("keydown", onKeyDown))
  onCleanup(() => document.removeEventListener("keydown", onKeyDown))

  const inputClass =
    "h-9 w-full rounded-lg border border-v2-border-border-strong bg-v2-background-bg-base px-3 text-12-regular text-v2-text-text-base placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus focus:outline-none transition"

  const validate = () => {
    if (!current() || !next() || !confirm()) return language.t("sidebar.account.error.required")
    if (next().length < MIN_PASSWORD_LENGTH)
      return language.t("sidebar.account.error.tooShort", { count: MIN_PASSWORD_LENGTH })
    if (next() === current()) return language.t("sidebar.account.error.samePassword")
    if (next() !== confirm()) return language.t("sidebar.account.error.mismatch")
    return null
  }

  const errorMessage = (code?: string) => {
    switch (code) {
      case "missing_fields":
        return language.t("sidebar.account.error.required")
      case "password_too_short":
        return language.t("sidebar.account.error.tooShort", { count: MIN_PASSWORD_LENGTH })
      case "password_unchanged":
        return language.t("sidebar.account.error.samePassword")
      case "invalid_current_password":
        return language.t("sidebar.account.error.invalidCurrent")
      case "password_change_disabled":
        return language.t("sidebar.account.error.disabled")
      case "account_suspended":
      case "account_removed":
      case "tenant_suspended":
        return language.t("sidebar.account.error.accessRevoked")
      default:
        return language.t("sidebar.account.error.failed")
    }
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (saving()) return

    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    const account = user()
    if (!account) {
      setError(language.t("sidebar.account.error.failed"))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`${DEFAULT_AUTH_URL}/api/v1/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: account.id,
          orgId: tenant()?.id,
          currentPassword: current(),
          newPassword: next(),
        }),
      })

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(errorMessage(data.error))
        return
      }

      props.onClose()
      showToast({
        variant: "success",
        icon: "check",
        title: language.t("sidebar.account.passwordUpdated"),
      })
    } catch {
      setError(language.t("sidebar.account.error.failed"))
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { key: "current", label: language.t("sidebar.account.currentPassword"), value: current, set: setCurrent },
    { key: "next", label: language.t("sidebar.account.newPassword"), value: next, set: setNext },
    { key: "confirm", label: language.t("sidebar.account.confirmPassword"), value: confirm, set: setConfirm },
  ]

  return (
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={language.t("sidebar.account.title")}
        class="flex w-full max-w-[380px] flex-col overflow-hidden rounded-xl border border-v2-border-border-strong bg-v2-background-bg-layer-02 shadow-2xl"
      >
        {/* Cabeçalho da conta */}
        <div class="flex items-center gap-3 border-b border-v2-border-border-base p-4">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: BRAND, color: "#ffffff" }}
          >
            {initials()}
          </div>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-14-medium text-v2-text-text-base">{user()?.name || user()?.email}</span>
            <span class="truncate text-12-regular text-v2-text-text-muted">
              {user()?.name && tenant()?.name ? `${tenant()!.name} · ${user()?.email}` : tenant()?.name || user()?.email}
            </span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label={language.t("common.close")}
            class="flex size-7 shrink-0 items-center justify-center rounded-md text-v2-icon-icon-muted transition hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base cursor-pointer"
          >
            <IconV2 name="close" size="small" />
          </button>
        </div>

        <Show
          when={view() === "menu"}
          fallback={
            <form class="flex flex-col gap-3 p-4" onSubmit={submit}>
              <button
                type="button"
                class="mb-1 flex w-fit items-center gap-1 text-12-medium text-v2-text-text-muted transition hover:text-v2-text-text-base cursor-pointer"
                onClick={() => {
                  setError(null)
                  setView("menu")
                }}
              >
                <span aria-hidden="true">←</span>
                <span>{language.t("sidebar.account.title")}</span>
              </button>

              <p class="text-12-regular text-v2-text-text-muted">
                {language.t("sidebar.account.changePasswordHint", { count: MIN_PASSWORD_LENGTH })}
              </p>

              <For each={fields}>
                {(field) => (
                  <div class="flex flex-col gap-1">
                    <label class="text-12-medium text-v2-text-text-muted" for={`account-${field.key}`}>
                      {field.label}
                    </label>
                    <input
                      id={`account-${field.key}`}
                      type={reveal() ? "text" : "password"}
                      autocomplete={field.key === "current" ? "current-password" : "new-password"}
                      class={inputClass}
                      value={field.value()}
                      onInput={(event) => field.set(event.currentTarget.value)}
                      disabled={saving()}
                    />
                  </div>
                )}
              </For>

              <button
                type="button"
                class="w-fit text-12-medium text-v2-text-text-muted transition hover:text-v2-text-text-base cursor-pointer"
                onClick={() => setReveal((value) => !value)}
              >
                {reveal() ? language.t("sidebar.account.hidePasswords") : language.t("sidebar.account.showPasswords")}
              </button>

              <Show when={error()}>
                <div class="rounded-lg border border-v2-border-border-base bg-surface-critical-weak px-3 py-2 text-12-regular text-text-on-critical-base">
                  {error()}
                </div>
              </Show>

              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  class="flex h-8 items-center justify-center rounded-lg border border-v2-border-border-base px-3 text-12-medium text-v2-text-text-muted transition hover:text-v2-text-text-base disabled:opacity-50 cursor-pointer"
                  onClick={props.onClose}
                  disabled={saving()}
                >
                  {language.t("common.cancel")}
                </button>
                <button
                  type="submit"
                  class="flex h-8 items-center justify-center rounded-lg px-3 text-12-medium transition disabled:opacity-50 cursor-pointer"
                  style={{ background: BRAND, color: "#ffffff" }}
                  disabled={saving()}
                >
                  {saving() ? language.t("common.saving") : language.t("sidebar.account.updatePassword")}
                </button>
              </div>
            </form>
          }
        >
          <div class="flex flex-col gap-1 p-2">
            <Show when={showPlan()}>
              <div class="mb-1 flex flex-col gap-0.5 rounded-lg bg-v2-background-bg-layer-01 px-3 py-2">
                <span class="text-11-regular uppercase tracking-wide text-v2-text-text-faint">
                  {language.t("account.plan.title")}
                </span>
                <span class="text-12-medium text-v2-text-text-base">{planLabel()}</span>
                <Show when={tenant()?.planType === "trial" && (tenant()?.trialDaysRemaining ?? 0) > 0}>
                  <span class="text-11-regular text-v2-text-text-muted">
                    {language.t("trial.banner.days", { days: tenant()?.trialDaysRemaining ?? 0 })}
                  </span>
                </Show>
                <Show when={tenant()?.maxUsers}>
                  <span class="text-11-regular text-v2-text-text-muted">
                    {language.t("account.plan.seats", { count: tenant()?.maxUsers ?? 0 })}
                  </span>
                </Show>
              </div>
            </Show>
            <Show when={tenantAuth.canChangePassword()}>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-12-medium text-v2-text-text-base transition hover:bg-v2-background-bg-layer-01 cursor-pointer"
                onClick={() => setView("password")}
              >
                <IconV2 name="edit" size="small" class="size-4 text-v2-icon-icon-muted" />
                <span class="flex-1">{language.t("sidebar.account.changePassword")}</span>
              </button>
            </Show>

            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-12-medium text-text-on-critical-base transition hover:bg-surface-critical-weak cursor-pointer"
              onClick={() => {
                props.onClose()
                tenantAuth.logout()
              }}
            >
              <IconV2 name="close" size="small" class="size-4" />
              <span class="flex-1">{language.t("sidebar.account.signOut")}</span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
