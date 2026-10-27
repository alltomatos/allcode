import { BrowserWindow, screen, WebContentsView } from "electron"
import { write as writeLog } from "./logging"
import {
  navigationErrorCode,
  normalizePanelBounds,
  toViewBounds,
  type NavigationErrorCode,
  type PanelBounds,
} from "./browser-panel-bounds"

export type { PanelBounds }

export type PanelState = {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: { code: NavigationErrorCode }
}

export type BrowserPanel = {
  view: WebContentsView
  setBounds(rect: PanelBounds | null): void
  toggle(visible?: boolean): boolean
  isVisible(): boolean
  navigate(url: string): Promise<void>
  goBack(): Promise<void>
  goForward(): Promise<void>
  reload(): Promise<void>
  state(): PanelState
  attachDebugger(): Promise<void>
  sendCommand<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
  destroy(): void
}

const panels = new WeakMap<BrowserWindow, BrowserPanel>()
// v1 targets a single active panel regardless of window count — the bridge
// addresses panels by a fixed "main" id, so the last-created panel wins.
let activePanel: BrowserPanel | undefined

export function createBrowserPanel(
  win: BrowserWindow,
  onStateChanged: (state: PanelState) => void,
): BrowserPanel {
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  view.setVisible(false)

  let visible = false
  let lastBounds: PanelBounds | null = null
  let pendingBounds: PanelBounds | null = null
  let viewDpr = 0
  let dprProbe: Promise<number> | undefined
  let lastError: PanelState["error"]
  let debuggerState: "detached" | "attaching" | "attached" = "detached"

  const emitState = () => onStateChanged(state())

  function probeViewDpr() {
    if (viewDpr) return Promise.resolve(viewDpr)
    if (dprProbe) return dprProbe
    dprProbe = view.webContents
      .executeJavaScript("window.devicePixelRatio")
      .then(
        (value) => (Number.isFinite(value) && value > 0 ? value : 1),
        () => 1,
      )
      .then((dpr) => {
        viewDpr = dpr
        dprProbe = undefined
        const next = pendingBounds
        pendingBounds = null
        if (next) applyBounds(next)
        return dpr
      })
    return dprProbe
  }

  function applyBounds(rect: PanelBounds) {
    const { bounds } = toViewBounds(rect, rect.dpr ?? 1, viewDpr || 1)
    if (win.isDestroyed()) return
    const [width, height] = win.getContentSize()
    const scale = screen.getDisplayMatching(win.getBounds()).scaleFactor
    const normalized = normalizePanelBounds(bounds, {
      width: (width * scale) / (viewDpr || 1),
      height: (height * scale) / (viewDpr || 1),
    })
    if (!visible) {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      return
    }
    view.setBounds(normalized)
  }

  void probeViewDpr()

  function state(): PanelState {
    const wc = view.webContents
    return {
      url: wc.getURL(),
      title: wc.getTitle(),
      isLoading: wc.isLoading(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      ...(lastError ? { error: lastError } : {}),
    }
  }

  view.webContents.on("did-navigate", () => {
    lastError = undefined
    emitState()
  })
  view.webContents.on("did-navigate-in-page", () => {
    lastError = undefined
    emitState()
  })
  view.webContents.on("page-title-updated", emitState)
  view.webContents.on("did-start-loading", () => {
    lastError = undefined
    emitState()
  })
  view.webContents.on("did-stop-loading", emitState)
  view.webContents.on("did-fail-load", (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame) return
    const error = navigationErrorCode(code)
    if (!error) return
    lastError = { code: error }
    emitState()
  })
  // A blank WebContentsView can report DPR 1 before it is attached/first
  // painted. Re-check after a real document loads and re-apply the bounds if
  // the view's native scale factor changed.
  view.webContents.on("did-finish-load", () => {
    void view.webContents.executeJavaScript("window.devicePixelRatio").then(
      (value) => {
        const dpr = Number.isFinite(value) && value > 0 ? value : 1
        if (Math.abs(dpr - (viewDpr || 1)) < 0.001) return
        viewDpr = dpr
        if (lastBounds) applyBounds(lastBounds)
      },
      () => undefined,
    )
  })

  view.webContents.debugger.on("detach", (_event, reason) => {
    writeLog("browser-panel", `debugger detached: ${reason}`)
    debuggerState = "detached"
  })

  async function attachDebugger() {
    if (debuggerState === "attached") return
    if (debuggerState === "attaching") {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (debuggerState !== "attaching") {
            clearInterval(check)
            resolve()
          }
        }, 20)
      })
      return
    }
    debuggerState = "attaching"
    try {
      if (!view.webContents.debugger.isAttached()) view.webContents.debugger.attach("1.3")
      await view.webContents.debugger.sendCommand("Page.enable")
      await view.webContents.debugger.sendCommand("DOM.enable")
      await view.webContents.debugger.sendCommand("Accessibility.enable")
      debuggerState = "attached"
    } catch (error) {
      debuggerState = "detached"
      throw error
    }
  }

  async function sendCommand<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    await attachDebugger()
    return (await view.webContents.debugger.sendCommand(method, params)) as T
  }

  // `history.back()`, `history.forward()` and `reload()` start asynchronously.
  // Resolving their promises immediately made the bridge report the previous
  // URL (or a stale loading flag) back to the model, so wait for the matching
  // lifecycle event instead. The timeout keeps a hung page from blocking the
  // caller forever.
  function waitForNavigation(run: () => void) {
    return new Promise<void>((resolve) => {
      const wc = view.webContents
      let timer: NodeJS.Timeout | undefined = setTimeout(finish, 10_000)
      function finish() {
        if (!timer) return
        clearTimeout(timer)
        timer = undefined
        wc.off("did-navigate", finish)
        wc.off("did-navigate-in-page", onInPage)
        wc.off("did-stop-loading", finish)
        wc.off("did-fail-load", onFail)
        resolve()
      }
      function onFail(_event: unknown, _code: number, _description: string, _url: string, isMainFrame: boolean) {
        if (isMainFrame) finish()
      }
      // Hash/anchor changes and SPA history updates only emit the in-page
      // event; without it, back/forward would stall until the timeout.
      function onInPage(_event: unknown, _url: string, isMainFrame: boolean) {
        if (isMainFrame) finish()
      }
      wc.on("did-navigate", finish)
      wc.on("did-navigate-in-page", onInPage)
      wc.on("did-stop-loading", finish)
      wc.on("did-fail-load", onFail)
      try {
        run()
      } catch (error) {
        writeLog("browser-panel", `navigation failed to start: ${String(error)}`, undefined, "warn")
        finish()
      }
    })
  }

  const panel: BrowserPanel = {
    view,
    setBounds(rect) {
      if (!rect) {
        lastBounds = null
        pendingBounds = null
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        return
      }
      // The rect is in the app renderer's CSS pixels. The view can use a
      // different device scale factor (observed DPR 1 while the window runs at
      // 120%), so convert before touching setBounds.
      lastBounds = rect
      if (!viewDpr) {
        pendingBounds = rect
        void probeViewDpr()
        return
      }
      applyBounds(rect)
    },
    toggle(next) {
      visible = next ?? !visible
      view.setVisible(visible)
      panel.setBounds(lastBounds)
      return visible
    },
    isVisible() {
      return visible
    },
    async navigate(url) {
      await view.webContents.loadURL(url)
    },
    goBack() {
      if (!view.webContents.navigationHistory.canGoBack()) return Promise.resolve()
      return waitForNavigation(() => view.webContents.navigationHistory.goBack())
    },
    goForward() {
      if (!view.webContents.navigationHistory.canGoForward()) return Promise.resolve()
      return waitForNavigation(() => view.webContents.navigationHistory.goForward())
    },
    reload() {
      return waitForNavigation(() => view.webContents.reload())
    },
    state,
    attachDebugger,
    sendCommand,
    destroy() {
      try {
        if (view.webContents.debugger.isAttached()) view.webContents.debugger.detach()
      } catch (error) {
        writeLog("browser-panel", `detach on destroy failed: ${String(error)}`, undefined, "warn")
      }
      try {
        win.contentView.removeChildView(view)
      } catch {
        // window may already be destroyed
      }
      if (activePanel === panel) activePanel = undefined
    },
  }

  panels.set(win, panel)
  activePanel = panel
  return panel
}

export function getBrowserPanel(win: BrowserWindow): BrowserPanel | undefined {
  return panels.get(win)
}

export function getActiveBrowserPanel(): BrowserPanel | undefined {
  return activePanel
}
