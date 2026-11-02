import { Show, createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { useTenantAuth } from "@/context/tenant-auth"

/** Warns the team before the company's trial expires and the portal blocks access. */
export function TrialBanner() {
  const language = useLanguage()
  const tenantAuth = useTenantAuth()

  const tenant = () => tenantAuth.store.tenant
  const days = createMemo(() => tenant()?.trialDaysRemaining ?? null)
  const visible = createMemo(() => {
    if (!tenantAuth.isLoggedIn()) return false
    if (tenant()?.planType !== "trial") return false
    return (days() ?? 0) > 0
  })
  const urgent = createMemo(() => (days() ?? 0) <= 3)
  const lastDay = createMemo(() => (days() ?? 0) <= 1)

  return (
    <Show when={visible()}>
      <div
        class="flex items-center justify-center gap-2 border-b px-4 py-1.5 text-12-regular"
        style={
          urgent()
            ? { background: "#7f1d1d", "border-color": "#991b1b", color: "#fee2e2" }
            : { background: "#78350f", "border-color": "#92400e", color: "#fef3c7" }
        }
        role="status"
      >
        <span class="text-12-medium">{language.t("trial.banner.title")}</span>
        <span aria-hidden="true">·</span>
        <span>
          {lastDay()
            ? language.t("trial.banner.lastDay")
            : language.t("trial.banner.days", { days: days() ?? 0 })}
        </span>
      </div>
    </Show>
  )
}
