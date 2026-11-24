/**
 * Definições e cálculos de precificação de referência para APIs de modelos de IA.
 * Permite comparar o custo real da organização no AllCode com a tabela cheia
 * direta cobrada oficialmente pela Anthropic (Claude 3.5 Sonnet) e OpenAI (GPT-4o).
 */

export type ProviderPricingRate = {
  readonly name: string
  readonly inputPerMillion: number
  readonly outputPerMillion: number
}

export type ReferenceRatesConfig = {
  readonly anthropic: ProviderPricingRate
  readonly openai: ProviderPricingRate
  readonly benchmarkMode?: "blended" | "anthropic" | "openai"
}

/**
 * Taxas oficiais de referência de mercado (valores por 1.000.000 de tokens em USD).
 * - Anthropic: Claude 3.5 Sonnet (tabela direta: $3.00 input / $15.00 output por 1M)
 * - OpenAI: GPT-4o (tabela direta: $2.50 input / $10.00 output por 1M)
 */
export const DEFAULT_REFERENCE_RATES: ReferenceRatesConfig = {
  anthropic: {
    name: "Anthropic Claude 3.5 Sonnet",
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  openai: {
    name: "OpenAI GPT-4o",
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
  },
  benchmarkMode: "blended",
}

export type TokenBreakdown = {
  readonly total?: number
  readonly input?: number
  readonly output?: number
  readonly reasoning?: number
}

export type ComparativeSavingsResult = {
  readonly tokensTotal: number
  readonly tokensInput: number
  readonly tokensOutput: number
  readonly tokensReasoning: number
  readonly actualCostUsd: number
  readonly referenceCostAnthropic: number
  readonly referenceCostOpenAI: number
  readonly referenceMarketCost: number
  readonly savingsUsd: number
  readonly savingsPercentage: number
}

/**
 * Calcula o custo oficial estimado a partir do breakdown de tokens e uma taxa de provedor.
 */
export function computeProviderOfficialCost(
  breakdown: { input: number; output: number },
  rate: ProviderPricingRate,
): number {
  const inputCost = (breakdown.input * rate.inputPerMillion) / 1_000_000
  const outputCost = (breakdown.output * rate.outputPerMillion) / 1_000_000
  return Number((inputCost + outputCost).toFixed(6))
}

/**
 * Normaliza os tokens de entrada e saída.
 * Caso apenas `total` seja conhecido e não haja discriminação de input/output,
 * assume proporção típica de agentes de engenharia: 80% prompt (contexto/código) e 20% completion.
 */
export function normalizeTokenBreakdown(breakdown?: TokenBreakdown): {
  total: number
  input: number
  output: number
  reasoning: number
} {
  const explicitInput = Math.max(0, breakdown?.input ?? 0)
  const explicitReasoning = Math.max(0, breakdown?.reasoning ?? 0)
  const explicitOutput = Math.max(0, (breakdown?.output ?? 0) + explicitReasoning)
  const explicitTotal = Math.max(0, breakdown?.total ?? 0)

  if (explicitInput > 0 || explicitOutput > 0) {
    const total = explicitTotal > 0 ? explicitTotal : explicitInput + explicitOutput
    return {
      total,
      input: explicitInput,
      output: explicitOutput,
      reasoning: explicitReasoning,
    }
  }

  if (explicitTotal > 0) {
    const inferredInput = Math.round(explicitTotal * 0.8)
    const inferredOutput = explicitTotal - inferredInput
    return {
      total: explicitTotal,
      input: inferredInput,
      output: inferredOutput,
      reasoning: 0,
    }
  }

  return { total: 0, input: 0, output: 0, reasoning: 0 }
}

/**
 * Calcula a economia comparativa financeira da organização em relação
 * aos custos de tabela direta das APIs oficiais da Anthropic e OpenAI.
 */
export function computeComparativeSavings(
  rawBreakdown: TokenBreakdown | undefined,
  actualCostUsd: number,
  configOverrides?: Partial<ReferenceRatesConfig>,
): ComparativeSavingsResult {
  const tokens = normalizeTokenBreakdown(rawBreakdown)
  const actualCost = Math.max(0, Number(actualCostUsd) || 0)

  const config: ReferenceRatesConfig = {
    anthropic: configOverrides?.anthropic ?? DEFAULT_REFERENCE_RATES.anthropic,
    openai: configOverrides?.openai ?? DEFAULT_REFERENCE_RATES.openai,
    benchmarkMode: configOverrides?.benchmarkMode ?? DEFAULT_REFERENCE_RATES.benchmarkMode ?? "blended",
  }

  const costAnthropic = computeProviderOfficialCost(tokens, config.anthropic)
  const costOpenAI = computeProviderOfficialCost(tokens, config.openai)

  let marketCost: number
  if (config.benchmarkMode === "anthropic") {
    marketCost = costAnthropic
  } else if (config.benchmarkMode === "openai") {
    marketCost = costOpenAI
  } else {
    marketCost = Number(((costAnthropic + costOpenAI) / 2).toFixed(6))
  }

  const savingsUsd = Number(Math.max(0, marketCost - actualCost).toFixed(4))
  const savingsPercentage =
    marketCost > 0 ? Number(((savingsUsd / marketCost) * 100).toFixed(1)) : 0

  return {
    tokensTotal: tokens.total,
    tokensInput: tokens.input,
    tokensOutput: tokens.output,
    tokensReasoning: tokens.reasoning,
    actualCostUsd: Number(actualCost.toFixed(4)),
    referenceCostAnthropic: Number(costAnthropic.toFixed(4)),
    referenceCostOpenAI: Number(costOpenAI.toFixed(4)),
    referenceMarketCost: Number(marketCost.toFixed(4)),
    savingsUsd,
    savingsPercentage,
  }
}

/**
 * Formata valores em dólares com casas decimais apropriadas.
 */
export function formatCurrencyUsd(amount?: number): string {
  const value = Math.max(0, amount ?? 0)
  if (value === 0) return "$0.00"
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formata duração em milissegundos para horas trabalhadas.
 * Ex: 3600000 -> "1h 0m", 90000000 -> "25h 0m", 150000 -> "2m", 0 -> "0h"
 */
export function formatWorkingHours(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return "0h"
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}m`
    return `${hours}h`
  }
  return `${minutes}m`
}
