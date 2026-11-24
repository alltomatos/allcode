import { describe, expect, test } from "bun:test"
import {
  DEFAULT_REFERENCE_RATES,
  computeComparativeSavings,
  computeProviderOfficialCost,
  formatCurrencyUsd,
  formatWorkingHours,
  normalizeTokenBreakdown,
} from "../src/lib/kpi-pricing"

describe("KPI Pricing & Comparative Savings", () => {
  describe("normalizeTokenBreakdown", () => {
    test("preserves explicit input, output and reasoning tokens", () => {
      const result = normalizeTokenBreakdown({
        input: 10_000,
        output: 2_000,
        reasoning: 500,
        total: 12_500,
      })
      expect(result.input).toBe(10_000)
      expect(result.output).toBe(2_500) // output + reasoning
      expect(result.reasoning).toBe(500)
      expect(result.total).toBe(12_500)
    })

    test("infers 80/20 breakdown when only total tokens are available", () => {
      const result = normalizeTokenBreakdown({ total: 100_000 })
      expect(result.total).toBe(100_000)
      expect(result.input).toBe(80_000)
      expect(result.output).toBe(20_000)
      expect(result.reasoning).toBe(0)
    })

    test("handles empty or zero tokens gracefully", () => {
      const result = normalizeTokenBreakdown()
      expect(result.total).toBe(0)
      expect(result.input).toBe(0)
      expect(result.output).toBe(0)
      expect(result.reasoning).toBe(0)
    })
  })

  describe("computeProviderOfficialCost", () => {
    test("calculates Anthropic Claude 3.5 Sonnet list prices correctly", () => {
      // 1M input ($3.00) + 1M output ($15.00) = $18.00
      const cost = computeProviderOfficialCost(
        { input: 1_000_000, output: 1_000_000 },
        DEFAULT_REFERENCE_RATES.anthropic,
      )
      expect(cost).toBe(18.0)
    })

    test("calculates OpenAI GPT-4o list prices correctly", () => {
      // 1M input ($2.50) + 1M output ($10.00) = $12.50
      const cost = computeProviderOfficialCost(
        { input: 1_000_000, output: 1_000_000 },
        DEFAULT_REFERENCE_RATES.openai,
      )
      expect(cost).toBe(12.5)
    })
  })

  describe("computeComparativeSavings", () => {
    test("calculates blended market cost and financial savings correctly", () => {
      // 1M input + 1M output:
      // Anthropic: $18.00
      // OpenAI: $12.50
      // Blended market: ($18.00 + $12.50) / 2 = $15.25
      // Custo real AllCode: $2.25
      // Economia esperada: $13.00 (85.2%)
      const savings = computeComparativeSavings(
        { input: 1_000_000, output: 1_000_000 },
        2.25,
      )

      expect(savings.tokensTotal).toBe(2_000_000)
      expect(savings.tokensInput).toBe(1_000_000)
      expect(savings.tokensOutput).toBe(1_000_000)
      expect(savings.actualCostUsd).toBe(2.25)
      expect(savings.referenceCostAnthropic).toBe(18.0)
      expect(savings.referenceCostOpenAI).toBe(12.5)
      expect(savings.referenceMarketCost).toBe(15.25)
      expect(savings.savingsUsd).toBe(13.0)
      expect(savings.savingsPercentage).toBe(85.2)
    })

    test("returns 100% savings when actual cost is zero (e.g. local models or free tier)", () => {
      const savings = computeComparativeSavings(
        { input: 500_000, output: 100_000 },
        0,
      )
      // Anthropic: 0.5 * 3 + 0.1 * 15 = 1.5 + 1.5 = $3.00
      // OpenAI: 0.5 * 2.5 + 0.1 * 10 = 1.25 + 1.0 = $2.25
      // Blended: (3.00 + 2.25) / 2 = $2.625
      expect(savings.actualCostUsd).toBe(0)
      expect(savings.savingsUsd).toBe(2.625)
      expect(savings.savingsPercentage).toBe(100)
    })

    test("handles zero tokens without dividing by zero", () => {
      const savings = computeComparativeSavings(undefined, 0)
      expect(savings.tokensTotal).toBe(0)
      expect(savings.referenceMarketCost).toBe(0)
      expect(savings.savingsUsd).toBe(0)
      expect(savings.savingsPercentage).toBe(0)
    })

    test("supports customizable reference rates and benchmark mode", () => {
      const customRates = {
        anthropic: {
          name: "Claude Opus High Tier",
          inputPerMillion: 15.0,
          outputPerMillion: 75.0,
        },
        openai: {
          name: "GPT-4o",
          inputPerMillion: 2.5,
          outputPerMillion: 10.0,
        },
        benchmarkMode: "anthropic" as const,
      }

      // 100k input + 20k output
      // Anthropic: 0.1 * 15 + 0.02 * 75 = 1.5 + 1.5 = $3.00
      const savings = computeComparativeSavings(
        { input: 100_000, output: 20_000 },
        0.5,
        customRates,
      )

      expect(savings.referenceMarketCost).toBe(3.0)
      expect(savings.savingsUsd).toBe(2.5)
      expect(savings.savingsPercentage).toBe(83.3)
    })
  })

  describe("formatWorkingHours", () => {
    test("formats various millisecond durations into readable hours and minutes", () => {
      expect(formatWorkingHours(0)).toBe("0h")
      expect(formatWorkingHours(undefined)).toBe("0h")
      expect(formatWorkingHours(45_000)).toBe("0m")
      expect(formatWorkingHours(120_000)).toBe("2m")
      expect(formatWorkingHours(3_600_000)).toBe("1h")
      expect(formatWorkingHours(5_400_000)).toBe("1h 30m")
      expect(formatWorkingHours(36_000_000)).toBe("10h")
      expect(formatWorkingHours(91_800_000)).toBe("25h 30m")
    })
  })

  describe("formatCurrencyUsd", () => {
    test("formats currency values cleanly", () => {
      expect(formatCurrencyUsd(0)).toBe("$0.00")
      expect(formatCurrencyUsd(142.5)).toBe("$142.50")
      expect(formatCurrencyUsd(1250.75)).toBe("$1,250.75")
      expect(formatCurrencyUsd(0.0042)).toBe("$0.0042")
    })
  })
})
