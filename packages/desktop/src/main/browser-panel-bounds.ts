export type PanelBounds = { x: number; y: number; width: number; height: number; dpr?: number }

/**
 * Converts a rect measured in the app renderer (CSS px) into the coordinate
 * space used by the embedded WebContentsView. On Windows the view can report
 * `devicePixelRatio: 1` even when the window renderer is at 120%/150%; its
 * bounds are then in physical pixels, so applying the CSS rect directly makes
 * the view render smaller and drift toward the top-left. `appDpr` comes from
 * the renderer, `viewDpr` from the view itself.
 */
export function toViewBounds(rect: PanelBounds, appDpr: number, viewDpr: number) {
  const factor = positive(appDpr) / positive(viewDpr)
  return {
    factor,
    bounds: {
      x: rect.x * factor,
      y: rect.y * factor,
      width: rect.width * factor,
      height: rect.height * factor,
    },
  }
}

/**
 * Keeps renderer-provided rectangles inside the window content area. The
 * renderer measures the placeholder while panes animate, so a frame captured
 * mid-transition must never make the native view paint outside its column.
 */
export function normalizePanelBounds(rect: PanelBounds, content: { width: number; height: number }): PanelBounds {
  const x = clamp(Math.round(rect.x), 0, content.width)
  const y = clamp(Math.round(rect.y), 0, content.height)
  return {
    x,
    y,
    width: clamp(Math.round(rect.width), 0, content.width - x),
    height: clamp(Math.round(rect.height), 0, content.height - y),
  }
}

function positive(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1
}

export type NavigationErrorCode = "offline" | "name_not_resolved" | "timeout" | "navigation_failed"

export function navigationErrorCode(code: number): NavigationErrorCode | undefined {
  // ERR_ABORTED is emitted for user-cancelled loads and superseded
  // navigations; it is not a failure worth surfacing.
  if (code === -3) return undefined
  if (code === -106) return "offline"
  if (code === -105) return "name_not_resolved"
  if (code === -7) return "timeout"
  return "navigation_failed"
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
