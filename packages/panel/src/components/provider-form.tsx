import { For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { BUILTIN_PROVIDERS, PROXY_PRESETS } from "~/lib/providers"
import type { ProviderDefinition, ProviderHeader, ProviderKind, ProviderModel } from "~/lib/store"
import { useI18n } from "~/i18n"
import { Button, Field, Select } from "./ui"

export type ProviderFormValue = {
  providerID: string
  displayName: string
  kind: ProviderKind
  baseURL: string
  apiKey?: string
  models: ProviderModel[]
  headers: ProviderHeader[]
  env: string
  enabled: boolean
}

export function ProviderForm(props: {
  kind: ProviderKind
  provider?: ProviderDefinition
  error?: string | null
  pending?: boolean
  onSubmit: (value: ProviderFormValue) => void
}) {
  const i18n = useI18n()
  const editing = () => Boolean(props.provider)
  const [state, setState] = createStore({
    providerID: props.provider?.providerID ?? "",
    displayName: props.provider?.displayName ?? "",
    baseURL: props.provider?.baseURL ?? "",
    apiKey: props.provider?.apiKey ?? "",
    env: (props.provider?.env ?? []).join(", "),
    enabled: props.provider?.enabled ?? true,
    models: (props.provider?.models ?? []) as ProviderModel[],
    headers: (props.provider?.headers ?? []) as ProviderHeader[],
  })

  function selectBuiltin(providerID: string) {
    const builtin = BUILTIN_PROVIDERS.find((entry) => entry.providerID === providerID)
    setState({ providerID, displayName: builtin?.displayName ?? state.displayName })
  }

  function selectPreset(presetID: string) {
    const preset = PROXY_PRESETS.find((entry) => entry.presetID === presetID)
    if (!preset) return
    setState({
      providerID: preset.providerID,
      displayName: preset.displayName,
      baseURL: preset.baseURL,
      models: [...preset.models],
    })
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    props.onSubmit({
      providerID: state.providerID,
      displayName: state.displayName,
      kind: props.kind,
      baseURL: state.baseURL,
      apiKey: state.apiKey.trim() || undefined,
      env: state.env,
      enabled: state.enabled,
      models: state.models.filter((model) => model.id.trim()),
      headers: state.headers.filter((header) => header.key.trim()),
    })
  }

  return (
    <form onSubmit={submit} class="space-y-4">
      <Show when={props.kind === "proxy" && !editing()}>
        <Select label={i18n.t("providers.form.preset")} name="proxyPreset" value="" onSelect={selectPreset}>
          <option value="">{i18n.t("providers.form.presetSelect")}</option>
          <For each={PROXY_PRESETS}>
            {(entry) => <option value={entry.presetID}>{entry.displayName} ({entry.baseURL})</option>}
          </For>
        </Select>
      </Show>

      <Show
        when={props.kind === "builtin" && !editing()}
        fallback={
          <Field
            label={i18n.t("providers.form.id")}
            name="providerID"
            value={state.providerID}
            placeholder={props.kind === "proxy" ? "9router" : "meuprovedor"}
            hint={i18n.t("providers.form.idHint")}
            disabled={editing()}
            required
            onInput={(event) => setState("providerID", event.currentTarget.value)}
          />
        }
      >
        <Select label={i18n.t("providers.form.id")} name="providerID" value={state.providerID} onSelect={selectBuiltin}>
          <option value="">—</option>
          <For each={BUILTIN_PROVIDERS}>
            {(entry) => <option value={entry.providerID}>{entry.displayName}</option>}
          </For>
        </Select>
      </Show>

      <Field
        label={i18n.t("providers.form.name")}
        name="displayName"
        value={state.displayName}
        placeholder={props.kind === "proxy" ? "9router Corporativo" : "Meu provedor de IA"}
        required
        onInput={(event) => setState("displayName", event.currentTarget.value)}
      />

      <Show when={props.kind === "custom" || props.kind === "proxy"}>
        <Field
          label={i18n.t("providers.form.baseUrl")}
          name="baseURL"
          value={state.baseURL}
          placeholder={props.kind === "proxy" ? "http://127.0.0.1:20128/v1" : "https://api.meuprovedor.com/v1"}
          required
          onInput={(event) => setState("baseURL", event.currentTarget.value)}
        />

        <Field
          label={i18n.t("providers.form.apiKey")}
          name="apiKey"
          value={state.apiKey}
          placeholder={props.kind === "proxy" ? "sk_omniroute (ou deixe vazio se sem autenticação)" : "sk-..."}
          hint={i18n.t("providers.form.apiKeyHint")}
          onInput={(event) => setState("apiKey", event.currentTarget.value)}
        />
      </Show>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700">{i18n.t("providers.form.models")}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setState("models", [...state.models, { id: "", name: "" }])}
          >
            {i18n.t("providers.form.addModel")}
          </Button>
        </div>
        <div class="space-y-2">
          <For each={state.models}>
            {(model, index) => (
              <div class="flex gap-2">
                <input
                  class="h-9 w-1/2 rounded-lg bg-white px-3 font-mono text-xs ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="claude-sonnet-4-5-thinking"
                  value={model.id}
                  onInput={(event) => setState("models", index(), "id", event.currentTarget.value)}
                />
                <input
                  class="h-9 w-1/2 rounded-lg bg-white px-3 text-xs ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Claude Sonnet 4.5"
                  value={model.name}
                  onInput={(event) => setState("models", index(), "name", event.currentTarget.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setState("models", state.models.filter((_, position) => position !== index()))}
                >
                  ×
                </Button>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={props.kind === "custom" || props.kind === "proxy"}>
        <Field
          label={i18n.t("providers.form.env")}
          name="env"
          value={state.env}
          placeholder="OPENAI_API_KEY"
          hint={i18n.t("providers.form.envHint")}
          onInput={(event) => setState("env", event.currentTarget.value)}
        />
      </Show>

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => setState("enabled", event.currentTarget.checked)}
          class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        {i18n.t("providers.form.enabled")}
      </label>

      <Show when={props.error}>
        <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{props.error}</div>
      </Show>

      <Button type="submit" disabled={props.pending}>
        {props.pending
          ? i18n.t("common.loading")
          : editing()
            ? i18n.t("providers.form.save")
            : i18n.t("providers.form.create")}
      </Button>
    </form>
  )
}
