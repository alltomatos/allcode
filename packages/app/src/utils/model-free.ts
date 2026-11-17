// Free means an opencode-family model (`opencode`, `opencode-go`, ...) with no input price.
// https://opencode.ai/docs/models#free-models
export function isFreeModel(providerID: string, cost: { input: number } | undefined) {
  if (providerID !== "opencode" && !providerID.startsWith("opencode-")) return false
  return !cost || cost.input === 0
}
