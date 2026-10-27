export type BrowserPanelBounds = { x: number; y: number; width: number; height: number; dpr?: number }

type RectLike = { x: number; y: number; width: number; height: number }

/**
 * Converts a DOMRect into the integer, non-negative bounds the main process
 * expects. Returns null for rects that would hide the native view (detached
 * elements report 0x0), which the caller uses to detach the view instead of
 * leaving it painted at a stale position.
 */
export function boundsFromRect(rect: RectLike, dpr = 1): BrowserPanelBounds | null {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return null
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
    dpr: Number.isFinite(dpr) && dpr > 0 ? dpr : 1,
  }
}

export function sameBounds(a: BrowserPanelBounds | null, b: BrowserPanelBounds | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.dpr === b.dpr
}

export type BrowserPanelErrorKey =
  | "browser.panel.error.offline"
  | "browser.panel.error.name"
  | "browser.panel.error.timeout"
  | "browser.panel.error.default"

export function browserPanelErrorKey(code: string | undefined): BrowserPanelErrorKey {
  switch (code) {
    case "offline":
      return "browser.panel.error.offline"
    case "name_not_resolved":
      return "browser.panel.error.name"
    case "timeout":
      return "browser.panel.error.timeout"
    default:
      return "browser.panel.error.default"
  }
}
