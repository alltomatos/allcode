import { For } from "solid-js"
import type { ProviderDefinition, ProviderGrant } from "~/lib/store"
import { useI18n } from "~/i18n"

export type ProviderGrantDraft = Record<string, "inherit" | "allow" | "deny">

export function providerGrantDraft(
  providers: ProviderDefinition[],
  grants: ProviderGrant[],
): ProviderGrantDraft {
  const draft: ProviderGrantDraft = {}
  for (const provider of providers) {
    const grant = grants.find((entry) => entry.providerID === provider.providerID)
    draft[provider.providerID] = grant ? (grant.effect === "allow" ? "allow" : "deny") : "inherit"
  }
  return draft
}

export function providerGrantPayload(draft: ProviderGrantDraft) {
  return Object.entries(draft).flatMap(([providerID, value]) =>
    value === "inherit" ? [] : [{ providerID, effect: value }],
  )
}

export function ProviderGrantRows(props: {
  providers: ProviderDefinition[]
  value: ProviderGrantDraft
  disabled?: boolean
  onChange: (providerID: string, value: "inherit" | "allow" | "deny") => void
}) {
  const i18n = useI18n()
  return (
    <div class="space-y-2">
      <For
        each={props.providers}
        fallback={<p class="text-[11px] text-slate-500">{i18n.t("providers.empty")}</p>}
      >
        {(provider) => (
          <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-2 py-1.5">
            <span class="min-w-0 text-xs text-slate-700">
              <span class="font-medium">{provider.displayName}</span>
              <span class="ml-1 font-mono text-[10px] text-slate-400">{provider.providerID}</span>
            </span>
            <select
              class="h-8 rounded-lg bg-white px-2 text-xs ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              value={props.value[provider.providerID] ?? "inherit"}
              disabled={props.disabled}
              onChange={(event) =>
                props.onChange(
                  provider.providerID,
                  event.currentTarget.value as "inherit" | "allow" | "deny",
                )
              }
            >
              <option value="inherit">{i18n.t("providers.grants.inherit")}</option>
              <option value="allow">{i18n.t("access.tristate.allow")}</option>
              <option value="deny">{i18n.t("access.tristate.deny")}</option>
            </select>
          </div>
        )}
      </For>
    </div>
  )
}
