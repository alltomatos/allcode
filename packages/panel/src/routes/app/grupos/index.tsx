import { A, createAsync, revalidate, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createGroup, listGroups } from "~/lib/actions"

export default function GroupsPage() {
  const i18n = useI18n()
  const groups = createAsync(() => listGroups())
  const create = useAction(createGroup)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = new FormData(event.currentTarget as HTMLFormElement)
    setPending(true)
    const result = await create(form)
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setError(null)
    revalidate("panel.groups")
  }

  return (
    <div>
      <PageHeader title={i18n.t("groups.title")} subtitle={i18n.t("groups.subtitle")} />

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 class="text-sm font-semibold text-slate-900">{i18n.t("groups.new")}</h2>
          <form class="mt-4 space-y-3" onSubmit={submit}>
            <Field label={i18n.t("groups.name")} name="name" required placeholder="RH" />
            <Field label={i18n.t("groups.description")} name="description" placeholder="Recursos Humanos" />
            <Show when={error()}>
              <div class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{error()}</div>
            </Show>
            <Button type="submit" class="w-full" disabled={pending()}>
              {pending() ? i18n.t("common.loading") : i18n.t("groups.new")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 class="text-sm font-semibold text-slate-900">{i18n.t("groups.title")}</h2>
          <Show
            when={(groups() ?? []).length > 0}
            fallback={<p class="mt-3 text-sm text-slate-500">{i18n.t("groups.empty")}</p>}
          >
            <ul class="mt-3 divide-y divide-slate-100">
              <For each={groups() ?? []}>
                {(group) => (
                  <li class="flex items-center justify-between gap-2 py-2">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-medium text-slate-900">{group.name}</div>
                      <Show when={group.description}>
                        <div class="truncate text-xs text-slate-500">{group.description}</div>
                      </Show>
                    </div>
                    <A href={`/app/grupos/${group.id}`} class="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                      {i18n.t("common.actions")}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Card>
      </div>
    </div>
  )
}
