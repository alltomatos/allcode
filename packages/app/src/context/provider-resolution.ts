export type ModelKey = {
  providerID: string
  modelID: string
  variant?: string | null
}

export type ResolutionSource = "session" | "corporate" | "local"

export type ResolvedProviderModel = {
  model: ModelKey
  source: ResolutionSource
}

export type ProviderResolutionOptions = {
  /** Explicit model chosen in the current session (e.g. prompt.model.current()). */
  sessionModel?: ModelKey | null
  /** Central corporate provider/model provisioned or defaulted by the portal. */
  corporateModel?: ModelKey | null
  /** Local provider/model configured on the user's machine (config.model or recent/defaults). */
  localModel?: ModelKey | null
  /** Whether the user has permission to configure custom providers / override corporate defaults. */
  canOverrideCorporate?: boolean
  /** Whether the specific provider ID is permitted by the policy allowlist/denylist. */
  isAllowed?: (providerID: string) => boolean
  /** Whether the model is known/connected and available for execution. */
  isValid?: (model: ModelKey) => boolean
}

/**
 * Resolves the active provider and model following the 3-tier precedence hierarchy:
 * 1. Session Selection (User with Permission): Manual selection in the session wins if the user has permission.
 * 2. Centralized Corporate Provider (Portal): Corporate default/provisioned proxy applies by default.
 * 3. Local Fallback: Local machine config/providers used when portal has no provider configured.
 *
 * If the user has permissions blocked (`canOverrideCorporate: false`), they cannot override
 * the corporate provider with a different local/custom provider.
 */
export function resolveActiveProviderModel(
  options: ProviderResolutionOptions,
): ResolvedProviderModel | undefined {
  const canOverride = options.canOverrideCorporate ?? true
  const isAllowed = options.isAllowed ?? (() => true)
  const isValid = options.isValid ?? (() => true)

  const corporate = options.corporateModel
  const corporateValid = corporate && isAllowed(corporate.providerID) && isValid(corporate)

  // 1. Session Selection (User with Permission)
  if (options.sessionModel) {
    const session = options.sessionModel
    const allowed = isAllowed(session.providerID)
    const valid = isValid(session)

    if (allowed && valid) {
      const isCorporateProvider = corporateValid && session.providerID === corporate.providerID
      // Allowed if user has permission to override OR the session model is within the corporate provider
      if (canOverride || isCorporateProvider) {
        return { model: session, source: "session" }
      }
    }
  }

  // 2. Centralized Corporate Provider (Portal)
  if (corporateValid) {
    return { model: corporate, source: "corporate" }
  }

  // 3. Local Fallback
  if (options.localModel) {
    const local = options.localModel
    if (isAllowed(local.providerID) && isValid(local)) {
      return { model: local, source: "local" }
    }
  }

  return undefined
}
