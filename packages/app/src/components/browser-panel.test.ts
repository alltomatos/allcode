import { describe, expect, it } from "bun:test"
import { isBrowserPanelAvailable } from "./browser-panel"
import { boundsFromRect, browserPanelErrorKey, sameBounds } from "./browser-panel-bounds"

describe("BrowserPanel availability", () => {
  it("reports available in browser environment", () => {
    expect(isBrowserPanelAvailable()).toBe(true)
  })
})

describe("BrowserPanel bounds", () => {
  it("rounds a laid-out rect to integer bounds", () => {
    expect(boundsFromRect({ x: 10.4, y: 20.6, width: 300.2, height: 200.8 })).toEqual({
      x: 10,
      y: 21,
      width: 300,
      height: 201,
      dpr: 1,
    })
  })

  it("carries the renderer device pixel ratio to the main process", () => {
    expect(boundsFromRect({ x: 1, y: 2, width: 300, height: 200 }, 1.2)).toMatchObject({ dpr: 1.2 })
    expect(boundsFromRect({ x: 1, y: 2, width: 300, height: 200 }, Number.NaN)).toMatchObject({ dpr: 1 })
  })

  it("returns null for detached or hidden placeholders", () => {
    expect(boundsFromRect({ x: 0, y: 0, width: 0, height: 0 })).toBeNull()
    expect(boundsFromRect({ x: 0, y: 0, width: 300, height: 0 })).toBeNull()
    expect(boundsFromRect({ x: Number.NaN, y: 0, width: 300, height: 200 })).toBeNull()
  })

  it("clamps negative offsets instead of hiding the panel", () => {
    expect(boundsFromRect({ x: -4, y: -2, width: 300, height: 200 })).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      dpr: 1,
    })
  })

  it("detects unchanged bounds so the bridge is not spammed", () => {
    expect(sameBounds(null, null)).toBe(true)
    expect(sameBounds({ x: 0, y: 0, width: 10, height: 10 }, null)).toBe(false)
    expect(sameBounds({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true)
    expect(sameBounds({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 11, height: 10 })).toBe(false)
  })
})

describe("BrowserPanel error messages", () => {
  it("maps navigation failures to user-facing keys", () => {
    expect(browserPanelErrorKey("offline")).toBe("browser.panel.error.offline")
    expect(browserPanelErrorKey("name_not_resolved")).toBe("browser.panel.error.name")
    expect(browserPanelErrorKey("timeout")).toBe("browser.panel.error.timeout")
    expect(browserPanelErrorKey("navigation_failed")).toBe("browser.panel.error.default")
    expect(browserPanelErrorKey(undefined)).toBe("browser.panel.error.default")
  })
})
