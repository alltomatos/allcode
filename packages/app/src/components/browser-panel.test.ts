import { describe, expect, it } from "bun:test"
import { isBrowserPanelAvailable } from "./browser-panel"

describe("BrowserPanel availability", () => {
  it("reports available in browser environment", () => {
    expect(isBrowserPanelAvailable()).toBe(true)
  })
})
