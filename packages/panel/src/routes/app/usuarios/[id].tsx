import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatGrid } from "~/components/ui"
import { useI18n } from "~/i18n"
import {
  getUser,
  getUserKPIs,
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
import { actionKey, formatDate, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0m"
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatTokens(tokens?: number): string {
  if (!tokens || tokens <= 0) return "0"
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

export default function UserDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const actor = createAsync(() => requireMe())
  const user = createAsync(() => getUser(params.id!))
  const kpis = createAsync(() => getUserKPIs(params.id!))
  const sessions = createAsync(() => getUserSessions(params.id!))
  const history = createAsync(() => listAudit(params.id!))

  const changeRole = useAction(setUserRole)
  const changeStatus = useAction(setUserStatus)
  const remove = useAction(removeUser)
  const saveAccess = useAction(updateUserAccess)
  const resetPassword = useAction(resetUserPassword)
  const groups = createAsync(() => listGroups())

  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [confirmEmail, setConfirmEmail] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [savingPermissions, setSavingPermissions] = createSignal(false)
  const [newPassword, setNewPassword] = createSignal("")
  const [resettingPassword, setResettingPassword] = createSignal(false)
  const [issuedPassword, setIssuedPassword] = createSignal<string | null>(null)
  const [copiedPassword, setCopiedPassword] = createSignal(false)

  // Estados locais para edição de acesso
  const [accessDraft, setAccessDraft] = createSignal<Record<string, "inherit" | "allow" | "deny">>({})
  const [settingsDraft, setSettingsDraft] = createSignal<"inherit" | "allow" | "deny">("inherit")
  const [groupDraft, setGroupDraft] = createSignal<string[]>([])
  const [providerDraft, setProviderDraft] = createSignal("")
  const [modelDraft, setModelDraft] = createSignal("")
  const [changePassDraft, setChangePassDraft] = createSignal(true)
  const [accessInitialized, setAccessInitialized] = createSignal(false)

  const isOwner = createMemo(() => actor()?.role === "owner")
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
      canOpenSettings:
        settingsDraft() === "inherit" ? undefined : settingsDraft() === "allow",
      canChangePassword: changePassDraft(),
      defaultProvider: providerDraft(),
      defaultModel: modelDraft(),
      groupIds: groupDraft(),
    })
    setSavingPermissions(false)

    if (result?.error) {
      setError(i18n.t(result.error))
    } else {
      setSuccess(i18n.t("user.permissions.saved"))
      revalidate("panel.user")
      revalidate("panel.users")
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
            // Inicializa os rascunhos de acesso a partir do colaborador carregado
            if (!accessInitialized()) {
              const draft: Record<string, "inherit" | "allow" | "deny"> = {}
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
              {/* ========================================================= */}
              {/* 1. DASHBOARD DE KPIS E CONSUMO CONSOLIDADO DO COLABORADOR */}
              {/* ========================================================= */}
              <Show when={kpis()}>
                {(metrics) => (
                  <StatGrid
                    items={[
                      {
                        label: i18n.t("user.kpis.sessions"),
                        value: metrics().totalSessions,
                      },
                      {
                        label: i18n.t("user.kpis.tokens"),
                        value: formatTokens(metrics().totalTokens),
                      },
                      {
                        label: i18n.t("user.kpis.cost"),
                        value: `$${metrics().totalCostUsd.toFixed(4)}`,
                      },
                      {
                        label: i18n.t("user.kpis.duration"),
                        value: formatDuration(metrics().totalDurationMs),
                      },
                    ]}
                  />
                )}
              </Show>

              <div class="grid gap-6 lg:grid-cols-3">
                {/* COLUNA ESQUERDA: PERFIL + AUDITORIA DE SESSÕES */}
                <div class="space-y-6 lg:col-span-2">
                  {/* Card Perfil do Usuário */}
                  <Card>
                    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.detail.profile")}</h2>
                      <div class="flex items-center gap-2">
                        <Badge tone={roleTone(current().role)}>{i18n.t(roleKey(current().role))}</Badge>
                        <Badge tone={statusTone(current().status)}>{i18n.t(statusKey(current().status))}</Badge>
                      </div>
                    </div>

                    <dl class="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                      <div>
                        <dt class="text-xs text-slate-500">{i18n.t("common.name")}</dt>
                        <dd class="mt-0.5 font-medium text-slate-900">{current().name}</dd>
                      </div>
                      <div>
                        <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
                        <dd class="mt-0.5 text-slate-900 font-mono text-xs">{current().email}</dd>
                      </div>
                      <div>
                        <dt class="text-xs text-slate-500">{i18n.t("common.createdAt")}</dt>
                        <dd class="mt-0.5 text-slate-700">{formatDate(current().createdAt, i18n.locale())}</dd>
                      </div>
                      <div>
                        <dt class="text-xs text-slate-500">{i18n.t("common.lastLogin")}</dt>
                        <dd class="mt-0.5 text-slate-700">
                          {current().lastLoginAt
                            ? formatDate(current().lastLoginAt, i18n.locale())
                            : i18n.t("common.never")}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-xs text-slate-500">{i18n.t("user.detail.appVersion")}</dt>
                        <dd class="mt-0.5">
                          <Show when={current().appVersion} fallback={<span class="text-slate-400">—</span>}>
                            <span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                              v{current().appVersion}
                            </span>
                            <Show when={current().appVersionAt}>
                              <span class="ml-2 text-[11px] text-slate-400">
                                {formatDate(current().appVersionAt, i18n.locale())}
                              </span>
                            </Show>
                          </Show>
                        </dd>
                      </div>
                    </dl>

                    <Show when={current().mustChangePassword}>
                      <div class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                        {i18n.t("user.detail.mustChange")}
                      </div>
                    </Show>
                  </Card>

                  {/* ========================================================= */}
                  {/* 2. AUDITORIA DE SESSÕES (CARDS COM RESUMOS E METADADOS)  */}
                  {/* ========================================================= */}
                  <Card>
                    <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.sessions.title")}</h2>
                        <span class="text-xs text-slate-500">Resumo executivo do que foi tratado em cada sessão de trabalho</span>
                      </div>
                      <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {sessions()?.length || 0} sessões
                      </span>
                    </div>

                    <Show
                      when={sessions()?.length}
                      fallback={
                        <EmptyState>{i18n.t("user.detail.noSessions")}</EmptyState>
                      }
                    >
                      <div class="space-y-3.5">
                        <For each={sessions()}>
                          {(s) => (
                            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                              <div class="flex flex-wrap items-start justify-between gap-2">
                                <div class="min-w-0 flex-1">
                                  <div class="flex items-center gap-2">
                                    <span class="font-semibold text-sm text-slate-900 truncate">
                                      {s.title}
                                    </span>
                                    <Show when={s.durationMs > 0}>
                                      <span class="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                        ⏱ {formatDuration(s.durationMs)}
                                      </span>
                                    </Show>
                                  </div>
                                </div>
                                <div class="flex items-center gap-2 text-xs">
                                  <span class="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200 ring-inset">
                                    {formatTokens(s.tokensTotal)} tokens
                                  </span>
                                  <span class="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
                                    ${s.costUsd.toFixed(4)} USD
                                  </span>
                                </div>
                              </div>

                              {/* Resumo executivo do chat */}
                              <p class="mt-2 text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/80">
                                {s.summary}
                              </p>

                              {/* Metadados: Workspace e Horários */}
                              <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                                <div class="flex items-center gap-1.5 min-w-0 truncate">
                                  <span class="text-slate-400">📁</span>
                                  <span class="font-mono text-slate-700 truncate" title={s.workspace}>
                                    {s.workspace}
                                  </span>
                                </div>
                                <div class="shrink-0 text-slate-400">
                                  {formatDate(s.startedAt, i18n.locale())}
                                </div>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </Card>

                  {/* Card Histórico de Auditoria Geral */}
                  <Card>
                    <h2 class="text-sm font-semibold text-slate-900 mb-3">{i18n.t("user.detail.audit")}</h2>
                    <Show when={history()?.length} fallback={<p class="text-sm text-slate-500">{i18n.t("audit.empty")}</p>}>
                      <ul class="divide-y divide-slate-100">
                        <For each={history()}>
                          {(event) => (
                            <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                              <span class="font-medium text-slate-900">{i18n.t(actionKey(event.action) ?? "audit.action")}</span>
                              <span class="text-slate-400">{formatDate(event.at, i18n.locale())}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </Card>
                </div>

                {/* ========================================================= */}
                {/* COLUNA DIREITA: BLOQUEIO / REVOGAÇÃO E RBAC GRANULAR     */}
                {/* ========================================================= */}
                <div class="space-y-6">
                  {/* Card 3: Bloqueio e Revogação Imediata */}
                  <Card class={current().status === "suspended" ? "border-rose-300 bg-rose-50/20" : ""}>
                    <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.detail.security")}</h2>
                    <p class="mt-1 text-xs text-slate-500">
                      Gerencie o acesso ou desative imediatamente o colaborador da organização.
                    </p>

                    <Show when={isOwner() && canChange()}>
                      <div class="mt-4">
                        <Select
                          label={i18n.t("user.detail.changeRole")}
                          name="role"
                          value={current().role}
                          onSelect={onRole}
                        >
                          <option value="member">{i18n.t("users.role.member")}</option>
                          <option value="admin">{i18n.t("users.role.admin")}</option>
                        </Select>
                      </div>
                    </Show>

                    {/* Botão de Bloqueio Imediato */}
                    <div class="mt-5">
                      <Show
                        when={current().status === "suspended"}
                        fallback={
                          <Button
                            variant="danger"
                            class="w-full"
                            disabled={!canChange() || pending()}
                            onClick={() => onStatus("suspended")}
                          >
                            🚫 {i18n.t("user.detail.suspend")}
                          </Button>
                        }
                      >
                        <Button
                          variant="primary"
                          class="w-full !bg-emerald-600 hover:!bg-emerald-500"
                          disabled={!canChange() || pending()}
                          onClick={() => onStatus("active")}
                        >
                          ✓ {i18n.t("user.detail.reactivate")}
                        </Button>
                      </Show>
                      <p class="mt-1.5 text-[11px] text-slate-500">
                        {current().status === "suspended"
                          ? "O colaborador está bloqueado e impedido de utilizar o AllCode Desktop."
                          : "Bloquear desconecta e invalida imediatamente os acessos do colaborador."}
                      </p>
                    </div>

                    {/* Redefinição de senha pelo administrador */}
                    <Show when={canChange()}>
                      <div class="mt-6 border-t border-slate-200 pt-4">
                        <h3 class="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                          {i18n.t("user.password.title")}
                        </h3>
                        <p class="mt-1 text-[11px] text-slate-500">{i18n.t("user.password.hint")}</p>

                        <input
                          type="text"
                          autocomplete="new-password"
                          class="mt-2 h-9 w-full rounded-lg bg-white px-3 font-mono text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                          value={newPassword()}
                          onInput={(event) => setNewPassword(event.currentTarget.value)}
                          placeholder={i18n.t("user.password.placeholder")}
                        />

                        <Button
                          variant="secondary"
                          class="mt-2 w-full"
                          disabled={resettingPassword()}
                          onClick={onResetPassword}
                        >
                          {resettingPassword() ? i18n.t("common.loading") : i18n.t("user.password.submit")}
                        </Button>

                        <Show when={issuedPassword()}>
                          {(password) => (
                            <div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                              <div class="flex items-center gap-2">
                                <code class="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-slate-900 ring-1 ring-slate-200">
                                  {password()}
                                </code>
                                <button
                                  type="button"
                                  class="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                                  onClick={copyIssuedPassword}
                                >
                                  {copiedPassword()
                                    ? i18n.t("common.copied")
                                    : i18n.t("user.password.copy")}
                                </button>
                              </div>
                            </div>
                          )}
                        </Show>

                        <Show when={success()}>
                          <p class="mt-2 text-[11px] text-emerald-700">{success()}</p>
                        </Show>
                      </div>
                    </Show>

                    {/* Remoção de Usuário (Owner apenas) */}
                    <Show when={canRemove()}>
                      <div class="mt-6 border-t border-slate-200 pt-4">
                        <label class="block text-xs font-medium text-slate-600">
                          {i18n.t("user.detail.removeConfirm")}
                        </label>
                        <input
                          class="mt-2 h-9 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-rose-500"
                          value={confirmEmail()}
                          onInput={(event) => setConfirmEmail(event.currentTarget.value)}
                          placeholder={current().email}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          class="mt-3 w-full"
                          disabled={pending() || confirmEmail().trim().toLowerCase() !== current().email}
                          onClick={onRemove}
                        >
                          {i18n.t("user.detail.remove")}
                        </Button>
                      </div>
                    </Show>
                  </Card>

                  {/* Card 4: Controle de Permissões Granulares (RBAC) */}
                  <Card>
                    <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                      <h2 class="text-sm font-semibold text-slate-900">
                        🛡️ {i18n.t("user.permissions.title")}
                      </h2>
                    </div>

                    <p class="text-xs text-slate-500 mb-4">
                      Defina a quais ferramentas o colaborador terá acesso no AllCode Desktop:
                    </p>

                    <div class="space-y-4">
                      <label class="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-slate-50 border border-slate-100">
                          <input
                            type="checkbox"
                            checked={accessDraft().agentui === "allow"}
                            onChange={(e) =>
                              setAccessDraft({ ...accessDraft(), agentui: e.currentTarget.checked ? "allow" : "deny" })
                            }
                            disabled={!canChange() || savingPermissions()}
                            class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        <div class="text-xs">
                          <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.agentui")}</span>
                          <span class="text-slate-500">{i18n.t("user.permissions.agentuiDesc")}</span>
                        </div>
                      </label>

                      <label class="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-slate-50 border border-slate-100">
                          <input
                            type="checkbox"
                            checked={accessDraft().routines === "allow"}
                            onChange={(e) =>
                              setAccessDraft({ ...accessDraft(), routines: e.currentTarget.checked ? "allow" : "deny" })
                            }
                            disabled={!canChange() || savingPermissions()}
                            class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        <div class="text-xs">
                          <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.routines")}</span>
                          <span class="text-slate-500">{i18n.t("user.permissions.routinesDesc")}</span>
                        </div>
                      </label>

                      <label class="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-slate-50 border border-slate-100">
                          <input
                            type="checkbox"
                            checked={changePassDraft()}
                            onChange={(e) => setChangePassDraft(e.currentTarget.checked)}
                            disabled={!canChange() || savingPermissions()}
                            class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        <div class="text-xs">
                          <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.changePassword")}</span>
                          <span class="text-slate-500">{i18n.t("user.permissions.changePasswordDesc")}</span>
                        </div>
                      </label>

                      <Show when={canChange()}>
                        <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
                          <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                            {i18n.t("access.resources.title")}
                          </p>
                          <For each={RESOURCES.filter((resource) => resource !== "agentui" && resource !== "routines")}>
                            {(resource) => (
                              <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5">
                                <span class="text-xs text-slate-700">{i18n.t(`access.resource.${resource}`)}</span>
                                <input
                                  type="checkbox"
                                  checked={accessDraft()[resource] === "allow"}
                                  onChange={(e) =>
                                    setAccessDraft({
                                      ...accessDraft(),
                                      [resource]: e.currentTarget.checked ? "allow" : "deny",
                                    })
                                  }
                                  disabled={savingPermissions()}
                                  class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </label>
                            )}
                          </For>
                        </div>

                        <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
                          <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                            {i18n.t("access.defaults.title")}
                          </p>
                          <input
                            class="h-9 w-full rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                            placeholder={i18n.t("access.defaults.provider")}
                            value={providerDraft()}
                            onInput={(e) => setProviderDraft(e.currentTarget.value)}
                          />
                          <input
                            class="h-9 w-full rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                            placeholder={i18n.t("access.defaults.model")}
                            value={modelDraft()}
                            onInput={(e) => setModelDraft(e.currentTarget.value)}
                          />
                          <p class="text-[11px] text-slate-500">{i18n.t("access.defaults.hint")}</p>
                        </div>

                        <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
                          <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                            {i18n.t("access.groups.title")}
                          </p>
                          <Show
                            when={(groups() ?? []).length > 0}
                            fallback={<p class="text-[11px] text-slate-500">{i18n.t("access.groups.empty")}</p>}
                          >
                            <For each={groups() ?? []}>
                              {(group) => (
                                <label class="flex items-center gap-2 text-xs text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={groupDraft().includes(group.id)}
                                    onChange={(e) =>
                                      setGroupDraft(
                                        e.currentTarget.checked
                                          ? [...groupDraft(), group.id]
                                          : groupDraft().filter((id) => id !== group.id),
                                      )
                                    }
                                    class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>{group.name}</span>
                                </label>
                              )}
                            </For>
                          </Show>
                        </div>

                        <div class="mt-4 border-t border-slate-100 pt-3">
                          <Select
                            label={i18n.t("access.settings.label")}
                            name="canOpenSettings"
                            value={settingsDraft()}
                            onSelect={(value) => setSettingsDraft(value as "inherit" | "allow" | "deny")}
                          >
                            <option value="inherit">{i18n.t("access.tristate.inherit")}</option>
                            <option value="allow">{i18n.t("access.tristate.allow")}</option>
                            <option value="deny">{i18n.t("access.tristate.deny")}</option>
                          </Select>
                        </div>
                      </Show>

                      <Show when={canChange()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          class="w-full mt-2"
                          disabled={savingPermissions()}
                          onClick={onSaveAccess}
                        >
                          {savingPermissions() ? i18n.t("common.loading") : i18n.t("user.permissions.save")}
                        </Button>
                      </Show>
                    </div>

                    <Show when={success()}>
                      <div class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
                        {success()}
                      </div>
                    </Show>

                    <Show when={error()}>
                      <div class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
                        {error()}
                      </div>
                    </Show>
                  </Card>
                </div>
              </div>
            </div>
          )
        }}
      </Show>
    </div>
  )
}
