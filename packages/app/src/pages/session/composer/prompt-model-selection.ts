import { batch, createMemo, startTransition } from "solid-js"
import { useModels } from "@/context/models"
import type { ModelKey, ModelSelection } from "@/context/local"
import { cycleModelVariant, getConfiguredAgentVariant, resolveModelVariant } from "@/context/model-variant"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useTenantAuth } from "@/context/tenant-auth"
import { useProviderPolicy } from "@/context/tenant-provider-policy"
import { useProviders } from "@/hooks/use-providers"
import { resolveDefaultModel } from "@/hooks/provider-catalog"

export function createPromptModelSelection(input: { agent: () => { model?: ModelKey; variant?: string } | undefined }) {
  const sdk = useSDK()
  const sync = useSync()
  const models = useModels()
  const prompt = usePrompt()
  const tenantAuth = useTenantAuth()
  const providerPolicy = useProviderPolicy()
  const providers = useProviders(() => sdk().directory)
  const connected = createMemo(() => new Set(providers.connected().map((item) => item.id)))

  const valid = (model: { providerID: string; modelID: string }) => {
    if (model.providerID === "combo") return true
    if (!providerPolicy.allows(model.providerID)) return false
    const provider = providers.all().get(model.providerID)
    return !!provider?.models[model.modelID] && connected().has(model.providerID)
  }

  const corporate = () => {
    const def = tenantAuth.defaultModel?.()
    if (!def?.provider || !def?.model) return undefined
    const key = { providerID: def.provider, modelID: def.model }
    return valid(key) ? key : undefined
  }

  const configured = () => {
    const model = resolveDefaultModel(providers.defaultModel(), sync().data.config.model)
    if (!model) return
    if (valid(model)) return model
  }

  const recent = () => models.recent.list().find(valid)
  const fallback = () => {
    const defaults = providers.default()
    return providers.connected().flatMap((provider) => {
      const modelID = defaults[provider.id] ?? Object.values(provider.models)[0]?.id
      return modelID ? [{ providerID: provider.id, modelID }] : []
    })[0]
  }

  const current = () => {
    const rawSession = prompt.model.current()
    const sessionModel: ModelKey | undefined = rawSession
      ? { providerID: rawSession.providerID, modelID: rawSession.modelID, variant: rawSession.variant ?? undefined }
      : undefined
    const canOverride = providerPolicy.canOverrideCorporate()
    const corp = corporate()

    // 1. Session selection (if user has permission to override or model matches corporate provider)
    if (sessionModel && valid(sessionModel)) {
      const isCorporateProvider = corp && sessionModel.providerID === corp.providerID
      if (canOverride || isCorporateProvider) {
        return models.find(sessionModel)
      }
    }

    // 2. Centralized corporate provider
    if (corp) {
      return models.find(corp)
    }

    // 3. Local fallback
    const key = [input.agent()?.model, configured(), recent(), fallback()].find(
      (item): item is ModelKey => !!item && valid(item),
    )
    if (!key) return
    return models.find(key)
  }
  const recentModels = createMemo(() =>
    models.recent
      .list()
      .map(models.find)
      .filter((item): item is NonNullable<typeof item> => !!item),
  )

  const selection = {
    ready: models.ready,
    current,
    recent: recentModels,
    list: models.list,
    cycle(direction: 1 | -1) {
      const items = recentModels()
      const item = current()
      if (!item) return
      const index = items.findIndex((entry) => entry.provider.id === item.provider.id && entry.id === item.id)
      if (index === -1) return
      const next = items[(index + direction + items.length) % items.length]
      if (next) selection.set({ providerID: next.provider.id, modelID: next.id })
    },
    set(item: ModelKey | undefined, options?: { recent?: boolean }) {
      if (item && !providerPolicy.allows(item.providerID)) return
      if (item && !providerPolicy.canOverrideCorporate()) {
        const corp = corporate()
        if (corp && item.providerID !== corp.providerID) {
          return
        }
      }
      startTransition(() =>
        batch(() => {
          prompt.model.set(item ? { ...item, variant: prompt.model.current()?.variant } : undefined)
          if (!item) return
          models.setVisibility(item, true)
          if (options?.recent) models.recent.push(item)
        }),
      )
    },
    visible: models.visible,
    setVisibility: models.setVisibility,
    category: models.category,
    setCategories: models.setCategories,
    variant: {
      configured() {
        const item = input.agent()
        const model = current()
        if (!item || !model) return
        return getConfiguredAgentVariant({
          agent: { model: item.model, variant: item.variant },
          model: { providerID: model.provider.id, modelID: model.id, variants: model.variants },
        })
      },
      selected() {
        return prompt.model.current()?.variant
      },
      current() {
        const resolved = resolveModelVariant({
          variants: this.list(),
          selected: this.selected(),
          configured: this.configured(),
        })
        if (resolved) return resolved
        const model = current()
        if (!model) return
        const saved = models.variant.get({ providerID: model.provider.id, modelID: model.id })
        if (saved && this.list().includes(saved)) return saved
      },
      list() {
        return Object.keys(current()?.variants ?? {})
      },
      set(value: string | undefined) {
        startTransition(() =>
          batch(() => {
            const model = current()
            if (!model) return
            prompt.model.set({ providerID: model.provider.id, modelID: model.id, variant: value ?? null })
            models.variant.set({ providerID: model.provider.id, modelID: model.id }, value)
          }),
        )
      },
      cycle() {
        const variants = this.list()
        if (variants.length === 0) return
        this.set(
          cycleModelVariant({
            variants,
            selected: this.selected(),
            configured: this.configured(),
          }),
        )
      },
    },
  } satisfies ModelSelection

  return selection
}
