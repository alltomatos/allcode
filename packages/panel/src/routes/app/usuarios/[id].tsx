import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { Show, createMemo, createSignal } from "solid-js"
import { EmptyState, PageHeader, cx } from "~/components/ui"
import { UserOverview } from "~/components/user-overview"
import { UserSettings } from "~/components/user-settings"
import { useI18n } from "~/i18n"
import {
  getUser,
  getUserKPIs,
  getUserModelUsage,
  getUserSessions,
  listAudit,
  listGroups,
  requireMe,
  resetUserPassword,
  setUserRole,
  setUserStatus,
  removeUser,
  updateUserAccess,
} from "~/lib/actions"
import { RESOURCES, type Resource } from "~/lib/access"

type Tab = "overview" | "settings"
type TriState = "inherit" | "allow" | "deny"

export default function UserDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const actor = createAsync(() => requireMe())
  const user = createAsync(() => getUser(params.id!))
  const kpis = createAsync(() => getUserKPIs(params.id!))
  const sessions = createAsync(() => getUserSessions(params.id!))
  const history = createAsync(() => listAudit(params.id!))
  const groups = createAsync(() => listGroups())

  const [tab, setTab] = createSignal<Tab>("overview")
  const [modelDays, setModelDays] = createSignal(0)
  const modelUsage = createAsync(() => getUserModelUsage(params.id!, modelDays() || undefined))

  const changeRole = useAction(setUserRole)
  const changeStatus = useAction(setUserStatus)
  const remove = useAction(removeUser)
  const saveAccess = useAction(updateUserAccess)
  const resetPassword = useAction(resetUserPassword)

  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [confirmEmail, setConfirmEmail] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [savingPermissions, setSavingPermissions] = createSignal(false)
  const [newPassword, setNewPassword] = createSignal("")
  const [resettingPassword, setResettingPassword] = createSignal(false)
  const [issuedPassword, setIssuedPassword] = createSignal<string | null>(null)
  const [copiedPassword, setCopiedPassword] = createSignal(false)

  const [accessDraft, setAccessDraft] = createSignal<Record<string, TriState>>({})
  const [settingsDraft, setSettingsDraft] = createSignal<TriState>("inherit")
  const [groupDraft, setGroupDraft] = createSignal<string[]>([])
  const [providerDraft, setProviderDraft] = createSignal("")
  const [modelDraft, setModelDraft] = createSignal("")
  const [changePassDraft, setChangePassDraft] = createSignal(true)
  const [accessInitialized, setAccessInitialized] = createSignal(false)

  const isOwner = createMemo(() => actor()?.role === "owner")
  const canManage = createMemo(() => actor()?.role === "owner" || actor()?.role === "admin")
  const canRemove = createMemo(() => isOwner() && user()?.role !== "owner")
  const canChange = createMemo(() => actor()?.id !== user()?.id && user()?.role !== "owner")

  async function onRole(value: string) {
    const target = user()
    if (!target) return
    const result = await changeRole(target.id, value as "admin" | "member")
    if (result?.error) setError(i18n.t(result.error))
    else {
      setError(null)
      revalidate("panel.user")
      revalidate("panel.users")
      revalidate("panel.audit")
    }
  }

  async function onStatus(status: "active" | "suspended") {
    const target = user()
    if (!target) return
    setPending(true)
    const result = await changeStatus(target.id, status)
    setPending(false)
    if (result?.error) setError(i18n.t(result.error))
    else {
      setError(null)
      revalidate("panel.user")
      revalidate("panel.users")
      revalidate("panel.stats")
      revalidate("panel.audit")
    }
  }

  async function onResetPassword() {
    const target = user()
    if (!target) return
    setResettingPassword(true)
    setError(null)
    setSuccess(null)
    setCopiedPassword(false)
    const result = await resetPassword(target.id, newPassword().trim() || undefined)
    setResettingPassword(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setIssuedPassword(result?.password ?? null)
    setNewPassword("")
    setSuccess(i18n.t("user.password.success"))
    revalidate("panel.user")
    revalidate("panel.audit")
  }

  async function copyIssuedPassword() {
    const value = issuedPassword()
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  async function onSaveAccess() {
    const target = user()
    if (!target) return
    setSavingPermissions(true)
    setError(null)
    setSuccess(null)

    const overrides: Record<string, boolean> = {}
    for (const [resource, value] of Object.entries(accessDraft())) {
      if (value === "allow") overrides[resource] = true
      if (value === "deny") overrides[resource] = false
    }

    const result = await saveAccess(target.id, {
      access: overrides,
      canOpenSettings: settingsDraft() === "inherit" ? undefined : settingsDraft() === "allow",
      canChangePassword: changePassDraft(),
      defaultProvider: providerDraft().trim() || undefined,
      defaultModel: modelDraft().trim() || undefined,
      groupIds: groupDraft(),
    })
    setSavingPermissions(false)
    if (result?.error) setError(i18n.t(result.error))
    else {
      setSuccess(i18n.t("user.permissions.saved"))
      revalidate("panel.user")
      revalidate("panel.audit")
    }
  }

  async function onRemove() {
    const target = user()
    if (!target) return
    setPending(true)
    const result = await remove(target.id, confirmEmail())
    setPending(false)
    if (result?.error) setError(i18n.t(result.error))
  }

  return (
    <div>
      <PageHeader
        title={user()?.name ? `${i18n.t("user.detail.title")}: ${user()!.name}` : i18n.t("user.detail.title")}
        subtitle={user()?.email}
        actions={
          <A href="/app/usuarios" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={user()} fallback={<EmptyState>{i18n.t("users.empty")}</EmptyState>}>
        {(current) => {
          if (!accessInitialized()) {
            const draft: Record<string, TriState> = {}
            for (const resource of RESOURCES) {
              const value = current().access[resource as Resource]
              draft[resource] = value === undefined ? "inherit" : value ? "allow" : "deny"
            }
            setAccessDraft(draft)
            setSettingsDraft(
              current().canOpenSettings === undefined ? "inherit" : current().canOpenSettings ? "allow" : "deny",
            )
            setGroupDraft(current().groupIDs ?? [])
            setProviderDraft(current().defaultProvider ?? "")
            setModelDraft(current().defaultModel ?? "")
            setChangePassDraft(current().canChangePassword)
            setAccessInitialized(true)
          }

          return (
            <div class="space-y-6">
              <div class="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTab("overview")}
                  class={cx(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition",
                    tab() === "overview" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {i18n.t("user.tabs.overview")}
                </button>
                <Show when={canManage()}>
                  <button
                    type="button"
                    onClick={() => setTab("settings")}
                    class={cx(
                      "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition",
                      tab() === "settings" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {i18n.t("user.tabs.settings")}
                  </button>
                </Show>
              </div>

              <Show
                when={tab() === "overview"}
                fallback={
                  <UserSettings
                    controller={{
                      user: current(),
                      isOwner: isOwner(),
                      canChange: canChange(),
                      canRemove: canRemove(),
                      groups: groups(),
                      accessDraft: accessDraft(),
                      settingsDraft: settingsDraft(),
                      groupDraft: groupDraft(),
                      providerDraft: providerDraft(),
                      modelDraft: modelDraft(),
                      changePassDraft: changePassDraft(),
                      newPassword: newPassword(),
                      issuedPassword: issuedPassword(),
                      copiedPassword: copiedPassword(),
                      confirmEmail: confirmEmail(),
                      pending: pending(),
                      savingPermissions: savingPermissions(),
                      resettingPassword: resettingPassword(),
                      error: error(),
                      success: success(),
                      setAccessDraft,
                      setSettingsDraft,
                      setGroupDraft,
                      setProviderDraft,
                      setModelDraft,
                      setChangePassDraft,
                      setNewPassword,
                      setConfirmEmail,
                      onRole,
                      onStatus,
                      onResetPassword,
                      onCopyPassword: copyIssuedPassword,
                      onSaveAccess,
                      onRemove,
                    }}
                  />
                }
              >
                <UserOverview
                  user={current()}
                  kpis={kpis()}
                  sessions={sessions()}
                  modelUsage={modelUsage()}
                  history={history()}
                  modelDays={modelDays()}
                  onModelDays={setModelDays}
                />
              </Show>
            </div>
          )
        }}
      </Show>
    </div>
  )
}
