import { describe, expect, it } from "bun:test"
import { navigationErrorCode, normalizePanelBounds, toViewBounds } from "./browser-panel-bounds"

describe("normalizePanelBounds", () => {
  it("keeps bounds inside the window content area", () => {
    expect(normalizePanelBounds({ x: 100, y: 50, width: 400, height: 300 }, { width: 1280, height: 800 })).toEqual({
      x: 100,
      y: 50,
      width: 400,
      height: 300,
    })
  })

  it("clips a rect that overflows the window", () => {
    expect(normalizePanelBounds({ x: 1000, y: 700, width: 800, height: 600 }, { width: 1280, height: 800 })).toEqual({
      x: 1000,
      y: 700,
      width: 280,
      height: 100,
    })
  })

  it("never returns negative offsets", () => {
    expect(normalizePanelBounds({ x: -10, y: -20, width: 400, height: 300 }, { width: 1280, height: 800 })).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    })
  })
})

describe("toViewBounds", () => {
  it("scales CSS bounds when the view reports DPR 1 on a 120% display", () => {
    const { factor, bounds } = toViewBounds({ x: 896, y: 88, width: 696, height: 741, dpr: 1.2 }, 1.2, 1)
    expect(factor).toBeCloseTo(1.2)
    expect(bounds.x).toBeCloseTo(1075.2)
    expect(bounds.y).toBeCloseTo(105.6)
    expect(bounds.width).toBeCloseTo(835.2)
    expect(bounds.height).toBeCloseTo(889.2)
  })

  it("keeps bounds untouched when the view inherits the display scale", () => {
    const { factor, bounds } = toViewBounds({ x: 896, y: 88, width: 696, height: 741, dpr: 1.2 }, 1.2, 1.2)
    expect(factor).toBeCloseTo(1)
    expect(bounds).toEqual({ x: 896, y: 88, width: 696, height: 741 })
  })

  it("ignores invalid DPR values", () => {
    const { factor } = toViewBounds({ x: 0, y: 0, width: 10, height: 10 }, 0, Number.NaN)
    expect(factor).toBe(1)
  })
})

describe("navigationErrorCode", () => {
  it("ignores cancelled navigations", () => {
    expect(navigationErrorCode(-3)).toBeUndefined()
  })

  it("maps the actionable Chromium failures", () => {
    expect(navigationErrorCode(-106)).toBe("offline")
    expect(navigationErrorCode(-105)).toBe("name_not_resolved")
    expect(navigationErrorCode(-7)).toBe("timeout")
    expect(navigationErrorCode(-2)).toBe("navigation_failed")
  })
})
