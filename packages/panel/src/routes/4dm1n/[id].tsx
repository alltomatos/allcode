import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getTenant, setTenantStatus, updateTenantLimits } from "~/lib/actions"
import { formatDate, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"

export default function TenantDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const data = createAsync(() => getTenant(params.id!))
  const changeStatus = useAction(setTenantStatus)
  const changeLimits = useAction(updateTenantLimits)
  const [error, setError] = createSignal<string | null>(null)
  const [newLimit, setNewLimit] = createSignal("")

  async function onToggleStatus() {
    const org = data()?.org
    if (!org) return
    const nextStatus = org.status === "active" ? "suspended" : "active"
    const res = await changeStatus(org.id, nextStatus)
    if (res?.error) setError(res.error)
    else {
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
      revalidate("panel.admin.stats")
    }
  }

  async function onUpdateLimits(e: SubmitEvent) {
    e.preventDefault()
    const org = data()?.org
    if (!org) return
    const limit = Number(newLimit() || org.maxUsers)
    if (limit <= 0) return
    const res = await changeLimits(org.id, limit)
    if (res?.error) setError(res.error)
    else {
      setNewLimit("")
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
    }
  }

  return (
    <div>
      <PageHeader
        title={data()?.org.name ?? i18n.t("admin.tenants.detail.title")}
        subtitle={`Tenant ID: ${params.id}`}
        actions={
          <A href="/4dm1n" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={data()} fallback={<p class="text-sm text-slate-500">{i18n.t("common.loading")}</p>}>
        {(current) => (
          <div class="space-y-6">
            <div class="grid gap-6 lg:grid-cols-3">
              <Card class="lg:col-span-2">
                <h2 class="text-sm font-semibold text-slate-900 mb-4">{i18n.t("admin.tenants.detail.overview")}</h2>
                <dl class="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("admin.tenants.col.company")}</dt>
                    <dd class="mt-0.5 font-medium text-slate-900">{current().org.name}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("admin.tenants.col.slug")}</dt>
                    <dd class="mt-0.5 font-mono text-slate-700">{current().org.slug}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("admin.tenants.col.status")}</dt>
                    <dd class="mt-0.5">
                      <Badge tone={current().org.status === "active" ? "success" : "danger"}>
                        {i18n.t(current().org.status === "active" ? "admin.tenants.status.active" : "admin.tenants.status.suspended")}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("admin.tenants.col.plan")}</dt>
                    <dd class="mt-0.5 font-medium text-slate-900">{current().org.maxUsers} assentos</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("common.createdAt")}</dt>
                    <dd class="mt-0.5 text-slate-700">{formatDate(current().org.createdAt, i18n.locale())}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
                    <dd class="mt-0.5 text-slate-700">{current().org.contactEmail ?? "—"}</dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <h2 class="text-sm font-semibold text-slate-900 mb-4">{i18n.t("common.actions")}</h2>
                <div class="space-y-4">
                  <div>
                    <Button
                      variant={current().org.status === "active" ? "danger" : "primary"}
                      class="w-full"
                      onClick={onToggleStatus}
                    >
                      {current().org.status === "active"
                        ? i18n.t("admin.tenants.detail.suspend")
                        : i18n.t("admin.tenants.detail.reactivate")}
                    </Button>
                    <p class="mt-1.5 text-[11px] text-slate-500">
                      Suspender bloqueia o acesso de todos os colaboradores deste cliente imediatamente.
                    </p>
                  </div>

                  <form onSubmit={onUpdateLimits} class="border-t border-slate-100 pt-4 space-y-2">
                    <Field
                      label={i18n.t("admin.tenants.detail.maxUsersUpdate")}
                      name="maxUsers"
                      type="number"
                      value={newLimit() || String(current().org.maxUsers)}
                      onInput={(e) => setNewLimit(e.currentTarget.value)}
                    />
                    <Button type="submit" variant="secondary" size="sm" class="w-full">
                      {i18n.t("common.save")}
                    </Button>
                  </form>
                </div>

                <Show when={error()}>
                  <div class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
                    {error()}
                  </div>
                </Show>
              </Card>
            </div>

            <Card>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-semibold text-slate-900">
                  {i18n.t("admin.tenants.detail.users")} ({current().users.length} / {current().org.maxUsers})
                </h2>
              </div>

              <Show when={current().users.length > 0} fallback={<EmptyState>{i18n.t("admin.tenants.detail.usersEmpty")}</EmptyState>}>
                <div class="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th class="px-4 py-2.5">{i18n.t("common.name")}</th>
                        <th class="px-4 py-2.5">{i18n.t("common.role")}</th>
                        <th class="px-4 py-2.5">{i18n.t("common.status")}</th>
                        <th class="px-4 py-2.5">{i18n.t("common.lastLogin")}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <For each={current().users}>
                        {(u) => (
                          <tr class="hover:bg-slate-50 transition text-xs">
                            <td class="px-4 py-2.5">
                              <div class="font-medium text-slate-900">{u.name}</div>
                              <div class="text-slate-500">{u.email}</div>
                            </td>
                            <td class="px-4 py-2.5">
                              <Badge tone={roleTone(u.role)}>{i18n.t(roleKey(u.role))}</Badge>
                            </td>
                            <td class="px-4 py-2.5">
                              <Badge tone={statusTone(u.status)}>{i18n.t(statusKey(u.status))}</Badge>
                            </td>
                            <td class="px-4 py-2.5 text-slate-500">
                              {u.lastLoginAt ? formatDate(u.lastLoginAt, i18n.locale()) : i18n.t("common.never")}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Card>
          </div>
        )}
      </Show>
    </div>
  )
}
