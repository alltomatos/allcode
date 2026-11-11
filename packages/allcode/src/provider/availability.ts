import type { ModelV2 } from "@allcode/core/model"
import type { ProviderV2 } from "@allcode/core/provider"
import type { Provider } from "./provider"

export type ComboSelection = { providerID: string; modelID: string }

/**
 * Predicado de disponibilidade para combos a partir do estado v1 do Provider.
 *
 * Um provider/modelo ausente ali significa que não há credencial conhecida no
 * escopo atual — que é exatamente o sinal que `Combo.resolve` precisa para não
 * escolher um membro inexistente. Um único helper evita que os quatro
 * consumidores (AgentUI, SessionPrompt, Memory, endpoint experimental) criem
 * regras próprias.
 */
export function selectableFrom(providers: Record<string, Provider.Info>) {
  return (selection: ComboSelection) =>
    Boolean(providers[selection.providerID as ProviderV2.ID]?.models[selection.modelID as ModelV2.ID])
}

export * as ProviderAvailability from "./availability"
