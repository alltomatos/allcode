import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { For, Show, createEffect, createSignal } from "solid-js"
import { Button, Card, EmptyState, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getGroup, listUsers, removeGroup, setGroupMembers, updateGroup } from "~/lib/actions"
import { RESOURCES, type Resource } from "~/lib/access"

export default function GroupDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const group = createAsync(() => getGroup(params.id!))
  const users = createAsync(() => listUsers())
  const save = useAction(updateGroup)
  const saveMembers = useAction(setGroupMembers)
  const remove = useAction(removeGroup)

  const [draft, setDraft] = createSignal<Record<string, "inherit" | "allow" | "deny"> | null>(null)
  const [settings, setSettings] = createSignal<"inherit" | "allow" | "deny">("allow")
  const [memberDraft, setMemberDraft] = createSignal<string[] | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)

  function ensureDraft() {
    const current = group()
    if (!current || draft()) return
    const next: Record<string, "inherit" | "allow" | "deny"> = {}
    for (const resource of RESOURCES) {
      const value = current.access[resource as Resource]
      next[resource] = value === undefined ? "inherit" : value ? "allow" : "deny"
    }
    setDraft(next)
    setSettings(current.canOpenSettings ? "allow" : "deny")
    setMemberDraft(current.memberIDs ?? [])
  }

  createEffect(ensureDraft)

  async function onSave() {
    const current = group()
    if (!current || !draft()) return
    const overrides: Record<string, boolean> = {}
    for (const [resource, value] of Object.entries(draft()!)) {
      if (value === "allow") overrides[resource] = true
      if (value === "deny") overrides[resource] = false
    }
    setPending(true)
    const result = await save(current.id, { access: overrides, canOpenSettings: settings() === "allow" })
    if (!result?.error) await saveMembers(current.id, memberDraft() ?? [])
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setError(null)
    setSuccess(i18n.t("groups.saved"))
    revalidate("panel.group")
    revalidate("panel.groups")
  }

  async function onRemove() {
    const current = group()
    if (!current) return
    await remove(current.id)
    revalidate("panel.groups")
    window.location.href = "/app/grupos"
  }

  return (
    <div>
      <PageHeader
        title={group()?.name ?? i18n.t("groups.title")}
        subtitle={group()?.description}
        actions={
          <A href="/app/grupos" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={group()} fallback={<EmptyState>{i18n.t("groups.empty")}</EmptyState>}>
        {(current) => {
          return (
            <div class="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 class="text-sm font-semibold text-slate-900">{i18n.t("access.resources.title")}</h2>
                <div class="mt-3 space-y-2">
                  <For each={RESOURCES}>
                    {(resource) => (
                      <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5">
                        <span class="text-xs text-slate-700">{i18n.t(`access.resource.${resource}`)}</span>
                        <select
                          class="h-8 rounded-lg bg-white px-2 text-xs ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500"
                          value={draft()?.[resource] ?? "inherit"}
                          onChange={(event) =>
                            setDraft({
                              ...draft()!,
                              [resource]: event.currentTarget.value as "inherit" | "allow" | "deny",
                            })
                          }
                        >
                          <option value="inherit">{i18n.t("access.tristate.inherit")}</option>
                          <option value="allow">{i18n.t("access.tristate.allow")}</option>
                          <option value="deny">{i18n.t("access.tristate.deny")}</option>
                        </select>
                      </div>
                    )}
                  </For>
                </div>

                <div class="mt-4 border-t border-slate-100 pt-3">
                  <Select
                    label={i18n.t("access.settings.label")}
                    name="canOpenSettings"
                    value={settings()}
                    onSelect={(value) => setSettings(value as "inherit" | "allow" | "deny")}
                  >
                    <option value="allow">{i18n.t("access.tristate.allow")}</option>
                    <option value="deny">{i18n.t("access.tristate.deny")}</option>
                  </Select>
                </div>

                <div class="mt-4 flex gap-2">
                  <Button variant="secondary" class="flex-1" disabled={pending()} onClick={onSave}>
                    {pending() ? i18n.t("common.loading") : i18n.t("groups.save")}
                  </Button>
                  <Button variant="danger" disabled={pending()} onClick={onRemove}>
                    {i18n.t("groups.remove")}
                  </Button>
                </div>

                <Show when={success()}>
                  <p class="mt-3 text-xs text-emerald-700">{success()}</p>
                </Show>
                <Show when={error()}>
                  <p class="mt-3 text-xs text-rose-700">{error()}</p>
                </Show>
              </Card>

              <Card>
                <h2 class="text-sm font-semibold text-slate-900">{i18n.t("groups.members")}</h2>
                <div class="mt-3 space-y-2">
                  <For each={users() ?? []}>
                    {(user) => (
                      <label class="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={(memberDraft() ?? current().memberIDs ?? []).includes(user.id)}
                          onChange={(event) =>
                            setMemberDraft(
                              event.currentTarget.checked
                                ? [...(memberDraft() ?? []), user.id]
                                : (memberDraft() ?? []).filter((id) => id !== user.id),
                            )
                          }
                          class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          {user.name} <span class="text-slate-400">({user.email})</span>
                        </span>
                      </label>
                    )}
                  </For>
                </div>
              </Card>
            </div>
          )
        }}
      </Show>
    </div>
  )
}
