import { describe, expect, test } from "bun:test"
import type { ProviderPolicy } from "./tenant-auth"
import { nextDisabledProviders } from "./tenant-provider-policy"

const restricted: ProviderPolicy = {
  restricted: true,
  allowLocal: false,
  allowed: ["allowed"],
  denied: [],
  version: "1",
}

describe("nextDisabledProviders", () => {
  test("converges once disabled providers leave the live catalog", () => {
    let known = ["allowed", "blocked-a", "blocked-b"]
    let disabled: string[] = []
    let previousApplied: string[] = []
    const history: string[] = []

    for (let pass = 0; pass < 10; pass += 1) {
      const next = nextDisabledProviders({ policy: restricted, known, previousApplied, disabled })
      history.push(next.applied.join(","))
      if (next.applied.join(",") === disabled.join(",")) break
      disabled = next.applied
      previousApplied = next.desired
      known = known.filter((id) => !disabled.includes(id))
    }

    expect(history.at(-1)).toBe("blocked-a,blocked-b")
    expect(history.length).toBeLessThan(4)
  })

  test("preserves local disables that the policy did not create", () => {
    const next = nextDisabledProviders({
      policy: restricted,
      known: ["allowed", "blocked"],
      previousApplied: [],
      disabled: ["local"],
    })

    expect(next.applied).toEqual(["blocked", "local"])
  })

  test("restores providers that the policy now allows", () => {
    const next = nextDisabledProviders({
      policy: { ...restricted, allowed: ["allowed", "blocked-a"] },
      known: ["allowed", "blocked-a", "blocked-b"],
      previousApplied: ["blocked-a", "blocked-b"],
      disabled: ["blocked-a", "blocked-b"],
    })

    expect(next.applied).toEqual(["blocked-b"])
  })
})
