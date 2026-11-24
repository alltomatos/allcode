export type ComboCandidate = { model: string }

export type ComboSelection = { providerID: string; modelID: string }

/**
 * Splits a `provider/model` combo entry on the **first** slash only, so
 * providers that encode their own namespace (e.g. `omnrt/agy/gemini-x`) keep
 * the remainder intact. Mirrors the convention used by `ModelPickerV2` and
 * `AgentUI.resolveModel`.
 */
export function parseComboModel(model: string): ComboSelection | undefined {
  const separator = model.indexOf("/")
  if (separator <= 0) return undefined
  const providerID = model.slice(0, separator)
  const modelID = model.slice(separator + 1)
  if (!providerID || !modelID) return undefined
  return { providerID, modelID }
}

/**
 * Picks the combo member to use. Shared by both resolvers (`Combo.resolve` in
 * the runtime and `SessionRunnerModel.resolveComboModel` in core) so ordering,
 * failover and availability filtering cannot drift apart.
 *
 * - `ordered` is already sorted/rotated by the caller.
 * - `isSelectable` filters members the caller knows are unavailable.
 * - `skip` is the last failed member: it is avoided when any other eligible
 *   member exists, and used as a last resort otherwise.
 */
export function pickComboModel(input: {
  ordered: readonly ComboCandidate[]
  skip?: string
  isSelectable?: (selection: ComboSelection) => boolean
}): ComboSelection | undefined {
  const eligible = input.ordered.flatMap((entry) => {
    const parsed = parseComboModel(entry.model)
    if (!parsed) return []
    if (input.isSelectable && !input.isSelectable(parsed)) return []
    return [{ entry, parsed }]
  })
  if (eligible.length === 0) return undefined
  const withoutSkip = input.skip ? eligible.filter((item) => item.entry.model !== input.skip) : eligible
  return (withoutSkip.length > 0 ? withoutSkip : eligible)[0]?.parsed
}

export * as ComboSelect from "./select"
