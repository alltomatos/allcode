import { describe, expect, test } from "bun:test"
import { describeBrowserFailure } from "../../src/tool/browser"

describe("browser tool failures", () => {
  test("uses the safe message returned by the bridge", () => {
    expect(
      describeBrowserFailure(409, {
        error: {
          code: "stale_ref",
          message: "That element reference is no longer valid. Take a new snapshot and try again.",
        },
      }),
    ).toBe("That element reference is no longer valid. Take a new snapshot and try again.")
  })

  test("never leaks the raw HTTP response", () => {
    expect(describeBrowserFailure(500, { unexpected: true })).toBe(
      "The browser could not complete this action. Try again.",
    )
    expect(describeBrowserFailure(502, "text/plain")).toBe("The browser could not complete this action. Try again.")
  })

  test("explains unavailable panels and timeouts", () => {
    expect(describeBrowserFailure(404, undefined)).toContain("browser panel is not available")
    expect(describeBrowserFailure(504, undefined)).toContain("did not respond in time")
  })
})
