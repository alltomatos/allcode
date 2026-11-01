import { For, Show, createSignal, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useAction } from "@solidjs/router"
import type { ProviderDefinition, ProviderHeader, ProviderModel, ProviderProtocol } from "~/lib/store"
import { testProviderConnection } from "~/lib/actions"
import { useI18n } from "~/i18n"
import { Button, Card, Field, Select } from "./ui"

export type ProviderFormValue = {
  providerID: string
  displayName: string
  kind: "custom"
  protocol: ProviderProtocol
  baseURL: string
  models: ProviderModel[]
  headers: ProviderHeader[]
  env: string
  enabled: boolean
}

export function ProviderForm(props: {
  provider?: ProviderDefinition
  error?: string | null
  pending?: boolean
  onSubmit: (value: ProviderFormValue) => void
}) {
  const i18n = useI18n()
  const editing = () => Boolean(props.provider)
  const testConnection = useAction(testProviderConnection)

  const [state, setState] = createStore({
    providerID: props.provider?.providerID ?? "",
    displayName: props.provider?.displayName ?? "",
    protocol: (props.provider?.protocol ?? "openai") as ProviderProtocol,
    baseURL: props.provider?.baseURL ?? "",
    testApiKey: "",
    env: (props.provider?.env ?? []).join(", "),
    enabled: props.provider?.enabled ?? true,
    models: (props.provider?.models ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      enabled: m.enabled !== false,
    })) as ProviderModel[],
    headers: (props.provider?.headers ?? []) as ProviderHeader[],
  })

  const [testing, setTesting] = createSignal(false)
  const [testStatus, setTestStatus] = createSignal<{ ok: boolean; message: string } | null>(null)
  const [searchFilter, setSearchFilter] = createSignal("")

  const filteredModels = createMemo(() => {
    const term = searchFilter().trim().toLowerCase()
    if (!term) return state.models.map((model, idx) => ({ model, originalIndex: idx }))
    return state.models
      .map((model, idx) => ({ model, originalIndex: idx }))
      .filter(
        ({ model }) =>
          model.id.toLowerCase().includes(term) || model.name.toLowerCase().includes(term),
      )
  })

  async function handleTestAndFetch() {
    if (!state.baseURL.trim()) {
      setTestStatus({ ok: false, message: i18n.t("providers.error.invalidUrl") })
      return
    }

    setTesting(true)
    setTestStatus(null)
    try {
      const res = await testConnection({
        protocol: state.protocol,
        baseURL: state.baseURL,
        apiKey: state.testApiKey.trim() || undefined,
      })

      if (res?.error) {
        setTestStatus({ ok: false, message: res.error })
      } else if (res?.ok && Array.isArray(res.models)) {
        const existingMap = new Map(state.models.map((m) => [m.id, m]))
        const merged: ProviderModel[] = []

        // Adiciona modelos encontrados mantendo status anterior se já existia
        for (const remote of res.models) {
          const prev = existingMap.get(remote.id)
          merged.push({
            id: remote.id,
            name: remote.name || remote.id,
            enabled: prev ? prev.enabled !== false : true,
          })
          existingMap.delete(remote.id)
        }

        // Mantém modelos manuais adicionados anteriormente
        for (const remaining of existingMap.values()) {
          merged.push(remaining)
        }

        setState("models", merged)
        setTestStatus({
          ok: true,
          message: `${res.models.length} modelos identificados com sucesso.`,
        })
      }
    } catch (err: any) {
      setTestStatus({ ok: false, message: err?.message || "Falha na conexão." })
    } finally {
      setTesting(false)
    }
  }

  function setAllModelsEnabled(enabled: boolean) {
    setState(
      "models",
      state.models.map((m) => ({ ...m, enabled })),
    )
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    props.onSubmit({
      providerID: state.providerID,
      displayName: state.displayName,
      kind: "custom",
      protocol: state.protocol,
      baseURL: state.baseURL,
      env: state.env,
      enabled: state.enabled,
      models: state.models.filter((model) => model.id.trim()),
      headers: state.headers.filter((header) => header.key.trim()),
    })
  }

  return (
    <form onSubmit={submit} class="space-y-6">
      <Card class="space-y-4">
        <h3 class="text-sm font-semibold text-slate-900">Configuração do Provedor</h3>

        {/* Escolha do Protocolo */}
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            {i18n.t("providers.form.protocol")}
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                state.protocol === "openai"
                  ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="protocol"
                value="openai"
                checked={state.protocol === "openai"}
                onChange={() => setState("protocol", "openai")}
                class="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div class="text-xs">
                <span class="block font-semibold text-slate-900">
                  {i18n.t("providers.form.protocol.openai")}
                </span>
                <span class="text-slate-500">
                  OpenAI, Groq, Ollama, DeepSeek, LiteLLM, 9router, OmniRoute, OpenRouter.
                </span>
              </div>
            </label>

            <label
              class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                state.protocol === "anthropic"
                  ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="protocol"
                value="anthropic"
                checked={state.protocol === "anthropic"}
                onChange={() => setState("protocol", "anthropic")}
                class="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div class="text-xs">
                <span class="block font-semibold text-slate-900">
                  {i18n.t("providers.form.protocol.anthropic")}
                </span>
                <span class="text-slate-500">
                  Anthropic Claude nativo ou proxies com formato de mensagens da Anthropic.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Nome e ID */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={i18n.t("providers.form.name")}
            name="displayName"
            value={state.displayName}
            placeholder="Ex.: Groq Corporativo, Anthropic Central"
            required
            onInput={(event) => {
              const name = event.currentTarget.value
              setState("displayName", name)
              if (!editing() && !state.providerID) {
                const autoId = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-")
                setState("providerID", autoId)
              }
            }}
          />

          <Field
            label={i18n.t("providers.form.id")}
            name="providerID"
            value={state.providerID}
            placeholder="ex: groq, claude, meu-provedor"
            hint={i18n.t("providers.form.idHint")}
            disabled={editing()}
            required
            onInput={(event) => setState("providerID", event.currentTarget.value)}
          />
        </div>

        {/* URL Base */}
        <Field
          label={i18n.t("providers.form.baseUrl")}
          name="baseURL"
          value={state.baseURL}
          placeholder={
            state.protocol === "anthropic"
              ? "https://api.anthropic.com"
              : "https://api.groq.com/openai/v1"
          }
          hint={i18n.t("providers.form.baseUrlHint")}
          required
          onInput={(event) => setState("baseURL", event.currentTarget.value)}
        />
      </Card>

      {/* Teste de Conexão e Busca de Modelos */}
      <Card class="space-y-4 border-indigo-100 bg-gradient-to-br from-indigo-50/20 to-transparent">
        <div>
          <h3 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>⚡</span> {i18n.t("providers.form.testAndFetch")}
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            {i18n.t("providers.form.apiKeyTestHint")}
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div class="flex-1">
            <Field
              label={i18n.t("providers.form.apiKeyTest")}
              name="testApiKey"
              type="password"
              value={state.testApiKey}
              placeholder="sk-..."
              onInput={(event) => setState("testApiKey", event.currentTarget.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            class="h-10 sm:mb-0 shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            disabled={testing() || !state.baseURL.trim()}
            onClick={handleTestAndFetch}
          >
            {testing() ? i18n.t("providers.form.testing") : i18n.t("providers.form.testAndFetch")}
          </Button>
        </div>

        <Show when={testStatus()}>
          {(status) => (
            <div
              class={`rounded-xl p-3 text-xs ring-1 ${
                status().ok
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-rose-50 text-rose-800 ring-rose-200"
              }`}
            >
              <div class="font-semibold">{status().ok ? "✓ Sucesso" : "✕ Erro na conexão"}</div>
              <div class="mt-0.5">{status().message}</div>
            </div>
          )}
        </Show>
      </Card>

      {/* Modelos Disponíveis com Toggle */}
      <Card class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">{i18n.t("providers.form.models")}</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              {i18n.t("providers.form.modelsSubtitle")}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="text-xs"
              onClick={() => setAllModelsEnabled(true)}
            >
              Ativar Todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="text-xs text-slate-500"
              onClick={() => setAllModelsEnabled(false)}
            >
              Desativar Todos
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setState("models", [...state.models, { id: "", name: "", enabled: true }])
              }
            >
              + {i18n.t("providers.form.addModel")}
            </Button>
          </div>
        </div>

        <Show when={state.models.length > 5}>
          <div class="relative">
            <input
              class="h-8 w-full rounded-lg bg-slate-50 px-3 pl-8 text-xs ring-1 ring-slate-200 ring-inset outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              placeholder="Filtrar modelos listados..."
              value={searchFilter()}
              onInput={(event) => setSearchFilter(event.currentTarget.value)}
            />
            <span class="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
          </div>
        </Show>

        <div class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          <Show
            when={filteredModels().length > 0}
            fallback={
              <div class="py-6 text-center text-xs text-slate-500">
                {state.models.length === 0
                  ? i18n.t("providers.form.noModels")
                  : "Nenhum modelo corresponde ao filtro de busca."}
              </div>
            }
          >
            <For each={filteredModels()}>
              {({ model, originalIndex }) => (
                <div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/40">
                  <label class="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={model.enabled !== false}
                      onChange={(event) =>
                        setState("models", originalIndex, "enabled", event.currentTarget.checked)
                      }
                      class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span
                      class={`text-xs font-semibold ${
                        model.enabled !== false ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {model.enabled !== false ? "Disponível" : "Bloqueado"}
                    </span>
                  </label>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-0">
                    <input
                      class="h-8 w-full rounded-md bg-white px-2.5 font-mono text-xs ring-1 ring-slate-200 ring-inset outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                      placeholder="ID do modelo (ex.: claude-3-5-sonnet)"
                      value={model.id}
                      onInput={(event) =>
                        setState("models", originalIndex, "id", event.currentTarget.value)
                      }
                    />
                    <input
                      class="h-8 w-full rounded-md bg-white px-2.5 text-xs ring-1 ring-slate-200 ring-inset outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                      placeholder="Nome amigável (ex.: Claude 3.5 Sonnet)"
                      value={model.name}
                      onInput={(event) =>
                        setState("models", originalIndex, "name", event.currentTarget.value)
                      }
                    />
                  </div>

                  <button
                    type="button"
                    class="text-slate-400 hover:text-rose-600 p-1 text-sm font-bold shrink-0"
                    title="Remover modelo"
                    onClick={() =>
                      setState("models", state.models.filter((_, pos) => pos !== originalIndex))
                    }
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Card>

      {/* Disponibilidade Geral e Envio */}
      <Card class="space-y-4">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => setState("enabled", event.currentTarget.checked)}
            class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <span class="block text-sm font-semibold text-slate-900">
              {i18n.t("providers.form.enabled")}
            </span>
            <span class="text-xs text-slate-500">
              Quando desativado, o provedor fica indisponível para todos os colaboradores do tenant.
            </span>
          </div>
        </label>

        <Show when={props.error}>
          <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
            {props.error}
          </div>
        </Show>

        <div class="pt-2">
          <Button type="submit" disabled={props.pending} class="w-full sm:w-auto">
            {props.pending
              ? i18n.t("common.loading")
              : editing()
                ? i18n.t("providers.form.save")
                : i18n.t("providers.form.create")}
          </Button>
        </div>
      </Card>
    </form>
  )
}
