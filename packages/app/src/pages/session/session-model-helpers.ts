import type { UserMessage } from "@allcode/sdk/v2"

type Local = {
  session: {
    reset(): void
    restore(msg: UserMessage): void
  }
}

type ModelSelection = {
  model: {
    current(): { id: string; provider: { id: string } } | undefined
    set(model: { providerID: string; modelID: string }): void
    variant: {
      current(): string | undefined
      set(variant: string | undefined): void
    }
  }
}

type PromptState = {
  model: {
    current(): { providerID: string; modelID: string; variant?: string | null } | undefined
    set(model: { providerID: string; modelID: string; variant?: string | null }): void
  }
}

export const resetSessionModel = (local: Local) => {
  local.session.reset()
}

export const syncSessionModel = (local: Local, msg: UserMessage) => {
  local.session.restore(msg)
}

export const syncPromptModel = (local: ModelSelection, prompt: PromptState) => {
  const model = local.model.current()
  if (!model) return
  const next = {
    providerID: model.provider.id,
    modelID: model.id,
    variant: local.model.variant.current(),
  }
  const current = prompt.model.current()
  if (current?.providerID === next.providerID && current.modelID === next.modelID && current.variant === next.variant)
    return
  prompt.model.set(next)
}

export const restorePromptModel = (
  local: ModelSelection,
  prompt: PromptState,
  fallback?: { providerID: string; modelID: string },
  options?: {
    canOverrideCorporate?: boolean
    isProviderAllowed?: (providerID: string) => boolean
  },
) => {
  const model = prompt.model.current()
  const canOverride = options?.canOverrideCorporate ?? true
  const isAllowed = options?.isProviderAllowed ?? (() => true)

  // 1. Session selection (User with Permission)
  if (model) {
    const modelAllowed = isAllowed(model.providerID)
    const isCorporate = fallback && model.providerID === fallback.providerID
    if (modelAllowed && (canOverride || isCorporate)) {
      const current = local.model.current()
      if (
        current?.provider.id === model.providerID &&
        current.id === model.modelID &&
        local.model.variant.current() === (model.variant ?? undefined)
      ) {
        return true
      }
      local.model.set({ providerID: model.providerID, modelID: model.modelID })
      local.model.variant.set(model.variant ?? undefined)
      return true
    }
  }

  // 2. Centralized corporate provider (Portal)
  if (fallback && isAllowed(fallback.providerID)) {
    local.model.set({ providerID: fallback.providerID, modelID: fallback.modelID })
    local.model.variant.set(undefined)
    return true
  }

  // 3. Local fallback
  return false
}

