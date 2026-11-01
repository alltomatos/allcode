import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { RESOURCES, type Resource } from "~/lib/access"
import type { PublicGroup, UserDetail } from "~/lib/actions"
import type { ProviderDefinition } from "~/lib/store"
import { ProviderGrantRows } from "./provider-grants"

type TriState = "inherit" | "allow" | "deny"

export type UserCredentialItem = {
  providerID: string
  maskedKey: string
  updatedAt: string
}

export type UserSettingsController = {
  user: UserDetail
  isOwner: boolean
  canManage: boolean
  canChange: boolean
  canRemove: boolean
  isSelf: boolean
  groups: PublicGroup[] | undefined
  providers: ProviderDefinition[] | undefined
  credentials: UserCredentialItem[] | undefined
  grantsDraft: Record<string, "inherit" | "allow" | "deny">
  accessDraft: Record<string, TriState>
  settingsDraft: TriState
  groupDraft: string[]
  providerDraft: string
  modelDraft: string
  changePassDraft: boolean
  newPassword: string
  issuedPassword: string | null
  copiedPassword: boolean
  confirmEmail: string
  pending: boolean
  savingPermissions: boolean
  resettingPassword: boolean
  savingCredential?: string | null
  error: string | null
  success: string | null
  setGrantsDraft: (value: Record<string, "inherit" | "allow" | "deny">) => void
  setAccessDraft: (value: Record<string, TriState>) => void
  setSettingsDraft: (value: TriState) => void
  setGroupDraft: (value: string[]) => void
  setProviderDraft: (value: string) => void
  setModelDraft: (value: string) => void
  setChangePassDraft: (value: boolean) => void
  setNewPassword: (value: string) => void
  setConfirmEmail: (value: string) => void
  onRole: (value: string) => void
  onStatus: (status: "active" | "suspended") => void
  onResetPassword: () => void
  onCopyPassword: () => void
  onSaveAccess: () => void
  onRemove: () => void
  onSaveCredential: (providerID: string, apiKey: string) => Promise<void>
  onRemoveCredential: (providerID: string) => Promise<void>
}

export function UserSettings(props: { controller: UserSettingsController }) {
  const i18n = useI18n()
  const controller = () => props.controller

  // Active models for selected default provider
  const activeProvider = createMemo(() =>
    (controller().providers ?? []).find((p) => p.providerID === controller().providerDraft),
  )
  const availableModels = createMemo(() =>
    (activeProvider()?.models ?? []).filter((m) => m.enabled !== false),
  )

  // Draft keys for individual credentials
  const [keyDrafts, setKeyDrafts] = createSignal<Record<string, string>>({})
  const [credentialFeedback, setCredentialFeedback] = createSignal<{
    providerID: string
    ok: boolean
    message: string
  } | null>(null)

  function getKeyDraft(providerID: string) {
    return keyDrafts()[providerID] ?? ""
  }

  function setKeyDraft(providerID: string, value: string) {
    setKeyDrafts((prev) => ({ ...prev, [providerID]: value }))
  }

  async function handleSaveCredential(providerID: string) {
    const key = getKeyDraft(providerID).trim()
    if (!key) return
    try {
      await controller().onSaveCredential(providerID, key)
      setKeyDraft(providerID, "")
      setCredentialFeedback({
        providerID,
        ok: true,
        message: i18n.t("providers.user.apiKeySaved"),
      })
      setTimeout(() => setCredentialFeedback(null), 3000)
    } catch (err: any) {
      setCredentialFeedback({
        providerID,
        ok: false,
        message: err?.message || "Falha ao salvar chave",
      })
    }
  }

  async function handleRemoveCredential(providerID: string) {
    try {
      await controller().onRemoveCredential(providerID)
      setCredentialFeedback({
        providerID,
        ok: true,
        message: i18n.t("providers.user.apiKeyRemoved"),
      })
      setTimeout(() => setCredentialFeedback(null), 3000)
    } catch (err: any) {
      setCredentialFeedback({
        providerID,
        ok: false,
        message: err?.message || "Falha ao remover chave",
      })
    }
  }

  return (
    <div class="grid gap-6 lg:grid-cols-2">
      {/* ========================================================= */}
      {/* COLUNA ESQUERDA: CREDENCIAIS DE PROVEDORES + SEGURANÇA   */}
      {/* ========================================================= */}
      <div class="space-y-6">
        {/* Card de Credenciais Individuais de Provedores */}
        <Card class="space-y-4">
          <div class="border-b border-slate-100 pb-3">
            <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span>🔑</span> {i18n.t("providers.user.credentialsTitle")}
            </h2>
            <p class="mt-1 text-xs text-slate-500">
              {i18n.t("providers.user.credentialsSubtitle")}
            </p>
          </div>

          <Show
            when={(controller().providers ?? []).filter((p) => p.enabled).length > 0}
            fallback={
              <div class="py-4 text-center text-xs text-slate-500">
                {i18n.t("providers.user.noProviders")}
              </div>
            }
          >
            <div class="space-y-4">
              <For each={(controller().providers ?? []).filter((p) => p.enabled)}>
                {(provider) => {
                  const existingCred = () =>
                    (controller().credentials ?? []).find(
                      (c) => c.providerID === provider.providerID,
                    )
                  const isConfigured = () => Boolean(existingCred())
                  const isSavingThis = () => controller().savingCredential === provider.providerID

                  return (
                    <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold text-slate-900 truncate">
                              {provider.displayName}
                            </span>
                            <Badge tone="brand">
                              {provider.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                            </Badge>
                            <Show
                              when={isConfigured()}
                              fallback={
                                <span class="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  Não configurada
                                </span>
                              }
                            >
                              <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                ✓ Configurada ({existingCred()!.maskedKey})
                              </span>
                            </Show>
                          </div>
                          <div class="mt-0.5 text-[11px] text-slate-400 font-mono truncate">
                            {provider.baseURL}
                          </div>
                        </div>

                        <Show when={isConfigured()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0"
                            onClick={() => handleRemoveCredential(provider.providerID)}
                          >
                            Remover
                          </Button>
                        </Show>
                      </div>

                      <div class="flex items-center gap-2">
                        <input
                          type="password"
                          class="h-8 flex-1 rounded-md bg-white px-2.5 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                          placeholder={
                            isConfigured()
                              ? "Alterar chave (insira nova API key)..."
                              : i18n.t("providers.user.apiKeyPlaceholder")
                          }
                          value={getKeyDraft(provider.providerID)}
                          onInput={(event) =>
                            setKeyDraft(provider.providerID, event.currentTarget.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!getKeyDraft(provider.providerID).trim() || isSavingThis()}
                          onClick={() => handleSaveCredential(provider.providerID)}
                        >
                          {isSavingThis() ? i18n.t("common.loading") : "Salvar Chave"}
                        </Button>
                      </div>

                      <Show
                        when={
                          credentialFeedback() &&
                          credentialFeedback()!.providerID === provider.providerID
                        }
                      >
                        <div
                          class={`text-[11px] p-1.5 rounded ${
                            credentialFeedback()!.ok
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-rose-700 bg-rose-50"
                          }`}
                        >
                          {credentialFeedback()!.message}
                        </div>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </Card>

        {/* Card de Segurança (Gestão do Colaborador) */}
        <Show when={controller().canChange || controller().isSelf}>
          <Card>
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.detail.security")}</h2>
            <p class="mt-1 text-xs text-slate-500">{i18n.t("user.settings.securityHint")}</p>

            <Show when={controller().isOwner}>
              <div class="mt-4">
                <Select
                  label={i18n.t("user.detail.changeRole")}
                  name="role"
                  value={controller().user.role}
                  onSelect={controller().onRole}
                >
                  <option value="member">{i18n.t("users.role.member")}</option>
                  <option value="admin">{i18n.t("users.role.admin")}</option>
                </Select>
              </div>
            </Show>

            <Show when={controller().canChange}>
              <div class="mt-4 border-t border-slate-100 pt-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-semibold text-slate-900">
                      {controller().user.status === "suspended"
                        ? i18n.t("users.status.suspended")
                        : i18n.t("users.status.active")}
                    </h3>
                    <p class="text-xs text-slate-500">
                      {controller().user.status === "suspended"
                        ? i18n.t("user.settings.suspendedHint")
                        : i18n.t("user.settings.suspendHint")}
                    </p>
                  </div>
                  <Button
                    variant={controller().user.status === "suspended" ? "secondary" : "danger"}
                    size="sm"
                    disabled={controller().pending}
                    onClick={() =>
                      controller().onStatus(
                        controller().user.status === "suspended" ? "active" : "suspended",
                      )
                    }
                  >
                    {controller().user.status === "suspended"
                      ? i18n.t("user.detail.reactivate")
                      : i18n.t("user.detail.suspend")}
                  </Button>
                </div>
              </div>
            </Show>

            <div class="mt-4 border-t border-slate-100 pt-4">
              <label class="block text-xs font-semibold text-slate-900">
                {i18n.t("user.password.title")}
              </label>
              <p class="mt-0.5 text-xs text-slate-500">{i18n.t("user.password.hint")}</p>
              <div class="mt-2 flex gap-2">
                <input
                  class="h-9 flex-1 rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                  placeholder={i18n.t("user.password.placeholder")}
                  value={controller().newPassword}
                  onInput={(event) => controller().setNewPassword(event.currentTarget.value)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={controller().resettingPassword}
                  onClick={controller().onResetPassword}
                >
                  {controller().resettingPassword
                    ? i18n.t("common.loading")
                    : i18n.t("user.password.submit")}
                </Button>
              </div>
            </div>

            <Show when={controller().issuedPassword}>
              {(password) => (
                <div class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                  <div class="flex items-center gap-2">
                    <code class="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-slate-900 ring-1 ring-slate-200">
                      {password()}
                    </code>
                    <button
                      type="button"
                      class="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      onClick={controller().onCopyPassword}
                    >
                      {controller().copiedPassword
                        ? i18n.t("common.copied")
                        : i18n.t("user.password.copy")}
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </Card>
        </Show>

        <Show when={controller().canRemove}>
          <Card class="border-rose-200">
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.detail.remove")}</h2>
            <label class="mt-2 block text-xs font-medium text-slate-600">
              {i18n.t("user.detail.removeConfirm")}
            </label>
            <input
              class="mt-2 h-9 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-rose-500"
              value={controller().confirmEmail}
              onInput={(event) => controller().setConfirmEmail(event.currentTarget.value)}
              placeholder={controller().user.email}
            />
            <Button
              variant="danger"
              size="sm"
              class="mt-3 w-full"
              disabled={
                controller().pending ||
                controller().confirmEmail.trim().toLowerCase() !== controller().user.email
              }
              onClick={controller().onRemove}
            >
              {i18n.t("user.detail.remove")}
            </Button>
          </Card>
        </Show>
      </div>

      {/* ========================================================= */}
      {/* COLUNA DIREITA: PERMISSÕES, MODELO PADRÃO E GRUPOS        */}
      {/* ========================================================= */}
      <Show when={controller().canManage}>
        <Card>
          <div class="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 class="text-sm font-semibold text-slate-900">
              🛡️ {i18n.t("user.permissions.title")}
            </h2>
          </div>
          <p class="mb-4 text-xs text-slate-500">{i18n.t("user.settings.permissionsHint")}</p>

          <div class="space-y-3">
            <PermissionRow
              label={i18n.t("user.permissions.agentui")}
              description={i18n.t("user.permissions.agentuiDesc")}
              checked={controller().accessDraft.agentui === "allow"}
              disabled={controller().savingPermissions}
              onChange={(checked) =>
                controller().setAccessDraft({
                  ...controller().accessDraft,
                  agentui: checked ? "allow" : "deny",
                })
              }
            />
            <PermissionRow
              label={i18n.t("user.permissions.routines")}
              description={i18n.t("user.permissions.routinesDesc")}
              checked={controller().accessDraft.routines === "allow"}
              disabled={controller().savingPermissions}
              onChange={(checked) =>
                controller().setAccessDraft({
                  ...controller().accessDraft,
                  routines: checked ? "allow" : "deny",
                })
              }
            />
            <PermissionRow
              label={i18n.t("user.permissions.changePassword")}
              description={i18n.t("user.permissions.changePasswordDesc")}
              checked={controller().changePassDraft}
              disabled={controller().savingPermissions}
              onChange={controller().setChangePassDraft}
            />

            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("access.resources.title")}
              </p>
              <For
                each={RESOURCES.filter(
                  (resource) => resource !== "agentui" && resource !== "routines",
                )}
              >
                {(resource: Resource) => (
                  <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5">
                    <span class="text-xs text-slate-700">
                      {i18n.t(`access.resource.${resource}`)}
                    </span>
                    <input
                      type="checkbox"
                      checked={controller().accessDraft[resource] === "allow"}
                      onChange={(event) =>
                        controller().setAccessDraft({
                          ...controller().accessDraft,
                          [resource]: event.currentTarget.checked ? "allow" : "deny",
                        })
                      }
                      disabled={controller().savingPermissions}
                      class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                )}
              </For>
            </div>

            {/* Padrão do Colaborador (Provedor e Modelo) */}
            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("access.defaults.title")}
              </p>
              <Select
                label={i18n.t("access.defaults.provider")}
                name="defaultProvider"
                value={controller().providerDraft}
                onSelect={(val) => {
                  controller().setProviderDraft(val)
                  controller().setModelDraft("")
                }}
                disabled={controller().savingPermissions}
              >
                <option value="">— {i18n.t("access.defaults.provider")} —</option>
                <For each={(controller().providers ?? []).filter((p) => p.enabled)}>
                  {(p) => <option value={p.providerID}>{p.displayName}</option>}
                </For>
              </Select>

              <Show
                when={availableModels().length > 0}
                fallback={
                  <input
                    class="h-9 w-full rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                    placeholder="Selecione um provedor com modelos disponíveis"
                    value={controller().modelDraft}
                    onInput={(event) => controller().setModelDraft(event.currentTarget.value)}
                    disabled={controller().savingPermissions}
                  />
                }
              >
                <Select
                  label={i18n.t("access.defaults.model")}
                  name="defaultModel"
                  value={controller().modelDraft}
                  onSelect={controller().setModelDraft}
                  disabled={controller().savingPermissions}
                >
                  <option value="">— Nenhum modelo padrão —</option>
                  <For each={availableModels()}>
                    {(m) => <option value={m.id}>{m.name || m.id}</option>}
                  </For>
                </Select>
              </Show>

              <p class="text-[11px] text-slate-500">{i18n.t("access.defaults.hint")}</p>
            </div>

            {/* Permissões de Provedores Concedidos */}
            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("providers.grants.title")}
              </p>
              <ProviderGrantRows
                providers={controller().providers ?? []}
                value={controller().grantsDraft}
                disabled={controller().savingPermissions}
                onChange={(providerID, value) =>
                  controller().setGrantsDraft({
                    ...controller().grantsDraft,
                    [providerID]: value,
                  })
                }
              />
              <p class="text-[11px] text-slate-500">{i18n.t("providers.grants.hint")}</p>
            </div>

            {/* Grupos de Perfil */}
            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("access.groups.title")}
              </p>
              <Show
                when={(controller().groups ?? []).length > 0}
                fallback={
                  <p class="text-[11px] text-slate-500">{i18n.t("access.groups.empty")}</p>
                }
              >
                <For each={controller().groups ?? []}>
                  {(group) => (
                    <label class="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={controller().groupDraft.includes(group.id)}
                        onChange={(event) =>
                          controller().setGroupDraft(
                            event.currentTarget.checked
                              ? [...controller().groupDraft, group.id]
                              : controller().groupDraft.filter((id) => id !== group.id),
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
                value={controller().settingsDraft}
                onSelect={(value) => controller().setSettingsDraft(value as TriState)}
              >
                <option value="inherit">{i18n.t("access.tristate.inherit")}</option>
                <option value="allow">{i18n.t("access.tristate.allow")}</option>
                <option value="deny">{i18n.t("access.tristate.deny")}</option>
              </Select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              class="mt-2 w-full"
              disabled={controller().savingPermissions}
              onClick={controller().onSaveAccess}
            >
              {controller().savingPermissions
                ? i18n.t("common.loading")
                : i18n.t("user.permissions.save")}
            </Button>
          </div>

          <Show when={controller().success}>
            <div class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
              {controller().success}
            </div>
          </Show>

          <Show when={controller().error}>
            <div class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
              {controller().error}
            </div>
          </Show>
        </Card>
      </Show>
    </div>
  )
}

function PermissionRow(props: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-2 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
        disabled={props.disabled}
        class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div class="text-xs">
        <span class="block font-semibold text-slate-900">{props.label}</span>
        <span class="text-slate-500">{props.description}</span>
      </div>
    </label>
  )
}
