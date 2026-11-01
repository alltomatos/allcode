import { For, Show } from "solid-js"
import { Button, Card, EmptyState, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { RESOURCES, type Resource } from "~/lib/access"
import type { PublicGroup, UserDetail } from "~/lib/actions"

type TriState = "inherit" | "allow" | "deny"

export type UserSettingsController = {
  user: UserDetail
  isOwner: boolean
  canChange: boolean
  canRemove: boolean
  groups: PublicGroup[] | undefined
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
  error: string | null
  success: string | null
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
}

export function UserSettings(props: { controller: UserSettingsController }) {
  const i18n = useI18n()
  const controller = () => props.controller

  return (
    <Show
      when={controller().canChange}
      fallback={<EmptyState>{i18n.t("user.settings.readOnly")}</EmptyState>}
    >
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-6">
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

            <div class="mt-5">
              <Show
                when={controller().user.status === "suspended"}
                fallback={
                  <Button
                    variant="danger"
                    class="w-full"
                    disabled={controller().pending}
                    onClick={() => controller().onStatus("suspended")}
                  >
                    🚫 {i18n.t("user.detail.suspend")}
                  </Button>
                }
              >
                <Button
                  variant="primary"
                  class="w-full !bg-emerald-600 hover:!bg-emerald-500"
                  disabled={controller().pending}
                  onClick={() => controller().onStatus("active")}
                >
                  ✓ {i18n.t("user.detail.reactivate")}
                </Button>
              </Show>
              <p class="mt-1.5 text-[11px] text-slate-500">
                {controller().user.status === "suspended"
                  ? i18n.t("user.settings.suspendedHint")
                  : i18n.t("user.settings.suspendHint")}
              </p>
            </div>
          </Card>

          <Card>
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.password.title")}</h2>
            <p class="mt-1 text-xs text-slate-500">{i18n.t("user.password.hint")}</p>

            <input
              type="text"
              autocomplete="new-password"
              class="mt-3 h-10 w-full rounded-lg bg-white px-3 font-mono text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
              value={controller().newPassword}
              onInput={(event) => controller().setNewPassword(event.currentTarget.value)}
              placeholder={i18n.t("user.password.placeholder")}
            />

            <Button
              variant="secondary"
              class="mt-2 w-full"
              disabled={controller().resettingPassword}
              onClick={controller().onResetPassword}
            >
              {controller().resettingPassword ? i18n.t("common.loading") : i18n.t("user.password.submit")}
            </Button>

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
                      {controller().copiedPassword ? i18n.t("common.copied") : i18n.t("user.password.copy")}
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </Card>

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

        <Card>
          <div class="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 class="text-sm font-semibold text-slate-900">🛡️ {i18n.t("user.permissions.title")}</h2>
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
              <For each={RESOURCES.filter((resource) => resource !== "agentui" && resource !== "routines")}>
                {(resource: Resource) => (
                  <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5">
                    <span class="text-xs text-slate-700">{i18n.t(`access.resource.${resource}`)}</span>
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

            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("access.defaults.title")}
              </p>
              <input
                class="h-9 w-full rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                placeholder={i18n.t("access.defaults.provider")}
                value={controller().providerDraft}
                onInput={(event) => controller().setProviderDraft(event.currentTarget.value)}
              />
              <input
                class="h-9 w-full rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none placeholder:font-sans focus:ring-2 focus:ring-indigo-500"
                placeholder={i18n.t("access.defaults.model")}
                value={controller().modelDraft}
                onInput={(event) => controller().setModelDraft(event.currentTarget.value)}
              />
              <p class="text-[11px] text-slate-500">{i18n.t("access.defaults.hint")}</p>
            </div>

            <div class="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p class="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                {i18n.t("access.groups.title")}
              </p>
              <Show
                when={(controller().groups ?? []).length > 0}
                fallback={<p class="text-[11px] text-slate-500">{i18n.t("access.groups.empty")}</p>}
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
              {controller().savingPermissions ? i18n.t("common.loading") : i18n.t("user.permissions.save")}
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
      </div>
    </Show>
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
