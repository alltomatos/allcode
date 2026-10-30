import { A, createAsync } from "@solidjs/router"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, PageHeader, buttonClass } from "~/components/ui"
import { useI18n } from "~/i18n"
import { listUsers } from "~/lib/actions"
import { formatDate, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"

export default function UsersPage() {
  const i18n = useI18n()
  const [search, setSearch] = createSignal("")
  const users = createAsync(() => listUsers())

  const filtered = createMemo(() => {
    const term = search().trim().toLowerCase()
    const list = users() ?? []
    if (!term) return list
    return list.filter((user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term))
  })

  return (
    <div>
      <PageHeader
        title={i18n.t("users.title")}
        subtitle={i18n.t("users.subtitle")}
        actions={
          <A href="/app/usuarios/novo" class={buttonClass("primary", "md")}>
            {i18n.t("users.new")}
          </A>
        }
      />

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          class="h-10 w-full max-w-sm rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          placeholder={i18n.t("users.searchPlaceholder")}
          value={search()}
          onInput={(event) => setSearch(event.currentTarget.value)}
          aria-label={i18n.t("common.search")}
        />
        <span class="text-xs text-slate-500">
          {filtered().length} {i18n.t("users.count")}
        </span>
      </div>

      <Show
        when={filtered().length > 0}
        fallback={
          <div class="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            {i18n.t("users.empty")}
          </div>
        }
      >
        <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th class="px-4 py-3">{i18n.t("common.name")}</th>
                <th class="hidden px-4 py-3 sm:table-cell">{i18n.t("common.role")}</th>
                <th class="px-4 py-3">{i18n.t("common.status")}</th>
                <th class="hidden px-4 py-3 lg:table-cell">{i18n.t("common.lastLogin")}</th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For each={filtered()}>
                {(user) => (
                  <tr class="transition hover:bg-slate-50">
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-900">{user.name}</div>
                      <div class="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td class="hidden px-4 py-3 sm:table-cell">
                      <Badge tone={roleTone(user.role)}>{i18n.t(roleKey(user.role))}</Badge>
                    </td>
                    <td class="px-4 py-3">
                      <Badge tone={statusTone(user.status)}>{i18n.t(statusKey(user.status))}</Badge>
                    </td>
                    <td class="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt, i18n.locale()) : i18n.t("common.never")}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <A
                        href={`/app/usuarios/${user.id}`}
                        class="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {i18n.t("common.actions")}
                      </A>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
