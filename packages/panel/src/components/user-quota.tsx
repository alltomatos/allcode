import { revalidate, useAction } from "@solidjs/router"
import { Show, createEffect, createSignal } from "solid-js"
import { Badge, Button, Card, Field } from "~/components/ui"
import { useI18n } from "~/i18n"
import { updateUserQuota } from "~/lib/actions"
import { formatTokenAmount } from "~/lib/quota"
import type { QuotaContext } from "~/lib/quota-service"
import { formatDate } from "~/lib/labels"

export function UserQuotaCard(props: {
  userID: string
  quota: QuotaContext | undefined
  canManage: boolean
}) {
  const i18n = useI18n()
  const save = useAction(updateUserQuota)
  const [value, setValue] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [saved, setSaved] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [initialized, setInitialized] = createSignal(false)

  createEffect(() => {
    if (initialized()) return
    const quota = props.quota
    if (!quota) return
    setValue(quota.userOverrideLimit === null ? "" : formatTokenAmount(quota.userOverrideLimit))
    setInitialized(true)
  })

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSaved(null)
    const result = await save(props.userID, { quota: value() })
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setSaved(value().trim() ? i18n.t("quota.user.saved") : i18n.t("quota.user.removed"))
    revalidate("panel.quota.user")
    revalidate("panel.quota.overview")
    revalidate("panel.user")
    revalidate("panel.users")
    revalidate("panel.audit")
  }

  return (
    <Card>
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">{i18n.t("quota.user.title")}</h2>
          <p class="mt-0.5 text-xs text-slate-500">{i18n.t("quota.user.subtitle")}</p>
        </div>
        <Show when={props.quota}>
          {(quota) => (
            <Badge tone={quota().blocked ? "danger" : "neutral"}>
              {quota().blocked
                ? quota().scope === "company"
                  ? i18n.t("quota.company.blocked")
                  : i18n.t("quota.user.blocked")
                : i18n.t("quota.badge.ok")}
            </Badge>
          )}
        </Show>
      </div>

      <Show when={props.quota}>
        {(quota) => (
          <div class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div class="text-[11px] uppercase tracking-wide text-slate-500">
                {i18n.t("quota.user.effective")}
              </div>
              <div class="mt-1 font-semibold text-slate-900">
                {quota().user.limit === null
                  ? i18n.t("quota.user.usingPool")
                  : formatTokenAmount(quota().user.limit)}
              </div>
              <div class="mt-0.5 text-[10px] text-slate-500">
                {i18n.t(`quota.source.${quota().userQuotaSource}`)}
              </div>
            </div>
            <div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div class="text-[11px] uppercase tracking-wide text-slate-500">{i18n.t("quota.user.used")}</div>
              <div class="mt-1 font-semibold text-slate-900">{formatTokenAmount(quota().user.used)}</div>
            </div>
            <div class="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div class="text-[11px] uppercase tracking-wide text-slate-500">{i18n.t("quota.user.remaining")}</div>
              <div class="mt-1 font-semibold text-slate-900">
                {quota().user.remaining === null
                  ? i18n.t("quota.company.remaining") + ": " + formatTokenAmount(quota().company.remaining)
                  : formatTokenAmount(quota().user.remaining)}
              </div>
            </div>
          </div>
        )}
      </Show>

      <Show when={props.quota}>
        {(quota) => (
          <div class="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong class="font-semibold text-slate-900">{i18n.t("quota.company.title")}:</strong>{" "}
                {formatTokenAmount(quota().company.used)}
                {" / "}
                {quota().company.limit === null
                  ? i18n.t("quota.company.unlimited")
                  : formatTokenAmount(quota().company.limit)}
              </span>
              <span>
                {i18n.t("quota.cycle")}: {formatDate(quota().cycleStart, i18n.locale())} →{" "}
                {formatDate(quota().cycleEnd, i18n.locale())}
              </span>
            </div>
          </div>
        )}
      </Show>

      <Show when={props.canManage}>
        <form onSubmit={submit} class="mt-4 space-y-3">
          <Field
            label={i18n.t("quota.user.override")}
            name="tokenQuota"
            value={value()}
            placeholder={i18n.t("quota.user.placeholder")}
            hint={i18n.t("quota.user.overrideHint")}
            onInput={(event) => setValue(event.currentTarget.value)}
          />
          <Show when={error()}>
            <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error()}
            </div>
          </Show>
          <Show when={saved()}>
            <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
              {saved()}
            </div>
          </Show>
          <Button type="submit" disabled={pending()}>
            {pending() ? i18n.t("common.loading") : i18n.t("common.save")}
          </Button>
        </form>
      </Show>
    </Card>
  )
}
