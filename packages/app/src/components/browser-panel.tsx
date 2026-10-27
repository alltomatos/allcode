import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type Accessor,
  type Component,
  type Setter,
} from "solid-js"
import { IconButtonV2 } from "@allcode/ui/v2/icon-button-v2"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { TextInputV2 } from "@allcode/ui/v2/text-input-v2"
import { Icon } from "@allcode/ui/icon"
import { useLanguage } from "@/context/language"
import {
  boundsFromRect,
  browserPanelErrorKey,
  sameBounds,
  type BrowserPanelBounds,
} from "@/components/browser-panel-bounds"

type BrowserPanelError = { code: string }
type BrowserPanelState = {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: BrowserPanelError
}

type BrowserPanelAPI = {
  setBounds: (rect: BrowserPanelBounds | null) => void
  toggle: (visible?: boolean) => Promise<boolean>
  state?: () => Promise<BrowserPanelState | undefined>
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  onStateChanged: (cb: (state: BrowserPanelState) => void) => () => void
}

// `window.api` is declared minimally per call site elsewhere (see app.tsx) —
// cast locally instead of extending the global `Window.api` shape, which
// requires every `declare global` merge to agree on an identical type.
function browserPanelAPI(): BrowserPanelAPI | undefined {
  return (window as unknown as { api?: { browserPanel?: BrowserPanelAPI } }).api?.browserPanel
}

type BrowserPanelModuleState = {
  open: Accessor<boolean>
  setOpen: Setter<boolean>
  lastOpenedUrl: string
  // The native view is shared by every mounted overlay, so exactly one
  // instance may own its visibility. Without this guard, unmounting the
  // stacked variant after the unstacked one mounts would hide a panel that is
  // still open.
  activeOwner?: object
  lastSessionKey?: string
  unsubscribe?: () => void
}

// Vite replaces this module on every edit. Keeping the shared signal and the
// view ownership here prevents the overlay and the panel geometry from ending
// up with different module instances (one open, one closed) during HMR.
const moduleState: BrowserPanelModuleState = (() => {
  const key = "__allcodeBrowserPanel"
  const scope = globalThis as typeof globalThis & { [key]?: BrowserPanelModuleState }
  if (scope[key]) return scope[key]
  const [open, setOpen] = createSignal(false)
  const next: BrowserPanelModuleState = { open, setOpen, lastOpenedUrl: "" }
  scope[key] = next
  return next
})()

const { open, setOpen } = moduleState

if (typeof window !== "undefined") {
  const api = browserPanelAPI()
  if (api && !moduleState.unsubscribe) {
    moduleState.unsubscribe = api.onStateChanged((next) => {
      if (next.url && next.url !== "about:blank" && next.url !== moduleState.lastOpenedUrl) {
        moduleState.lastOpenedUrl = next.url
        // Only flip the renderer state here. The overlay owns bounds and
        // visibility, so the native view is never shown with a stale rect.
        moduleState.setOpen(true)
      }
    })
  }
}

export function isBrowserPanelAvailable() {
  return typeof window !== "undefined"
}

export function isBrowserPanelOpen() {
  return open()
}

export function openBrowserPanel() {
  setOpen(true)
}

export function closeBrowserPanel() {
  setOpen(false)
  const api = browserPanelAPI()
  if (api) {
    api.setBounds(null)
    void api.toggle(false)
  }
}

export function toggleBrowserPanel() {
  if (open()) {
    closeBrowserPanel()
  } else {
    openBrowserPanel()
  }
}

export const BrowserPanelOverlay: Component<{ stacked?: boolean; sessionKey?: string }> = (props) => {
  const language = useLanguage()
  const owner = {}
  // The placeholder is created and destroyed with the panel, so track it as a
  // signal: a ResizeObserver attached once in `onMount` would keep observing a
  // detached node and silently stop reporting layout changes.
  const [placeholder, setPlaceholder] = createSignal<HTMLDivElement>()
  let lastBounds: BrowserPanelBounds | null = null
  let syncFrame: number | undefined
  let safetyTimer: number | undefined
  const [addressInput, setAddressInput] = createSignal("")
  const [editingAddress, setEditingAddress] = createSignal(false)
  // The main process keeps the last failure until the next load starts, so a
  // dismissed banner must stay dismissed on unrelated state events.
  const [dismissedError, setDismissedError] = createSignal<string>()
  const [state, setState] = createSignal<BrowserPanelState>({
    url: "",
    title: "",
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
  })

  const pushBounds = () => {
    const api = browserPanelAPI()
    if (!api) return
    const element = placeholder()
    const next =
      open() && element ? boundsFromRect(element.getBoundingClientRect(), window.devicePixelRatio) : null
    if (sameBounds(next, lastBounds)) return
    lastBounds = next
    api.setBounds(next)
  }

  // Mounting into a live layout can happen while the chat panel is still
  // transitioning or after the conversation pane was resized, so reconcile on
  // the next frame as well instead of trusting a single snapshot.
  const scheduleSync = () => {
    if (syncFrame !== undefined) return
    syncFrame = requestAnimationFrame(() => {
      syncFrame = undefined
      pushBounds()
    })
  }

  const show = () => {
    const api = browserPanelAPI()
    if (!api) return
    moduleState.activeOwner = owner
    // Apply bounds before revealing the native view.
    pushBounds()
    void api.toggle(true).then(() => {
      pushBounds()
      scheduleSync()
    })
    scheduleSync()
  }

  const hide = () => {
    const api = browserPanelAPI()
    if (!api) return
    lastBounds = null
    api.setBounds(null)
    void api.toggle(false)
  }

  const visibleError = () => {
    const error = state().error
    return error && error.code !== dismissedError() ? error : undefined
  }

  const clearError = () => {
    const code = state().error?.code
    if (code) setDismissedError(code)
    setState((prev) => ({ ...prev, error: undefined }))
  }

  onMount(() => {
    const api = browserPanelAPI()
    if (!api) return
    const unsubscribe = api.onStateChanged((next) => {
      setState(next)
      if (!next.error) setDismissedError(undefined)
      if (!editingAddress()) setAddressInput(next.url)
      moduleState.lastOpenedUrl = next.url
    })
    // The overlay can be re-created when the session panel remounts. Without
    // hydrating, the page stays on screen while the address bar and the
    // navigation buttons believe no page is open.
    void api
      .state?.()
      .then((next) => {
        if (!next) return
        setState(next)
        if (!editingAddress()) setAddressInput(next.url)
        moduleState.lastOpenedUrl = next.url
      })
      .catch(() => undefined)
    window.addEventListener("resize", scheduleSync)
    document.addEventListener("scroll", scheduleSync, true)
    window.visualViewport?.addEventListener("resize", scheduleSync)
    window.visualViewport?.addEventListener("scroll", scheduleSync)
    // Safety net for layout changes that do not resize the placeholder
    // (for example moving the window between displays with different DPI).
    safetyTimer = window.setInterval(() => {
      if (open()) scheduleSync()
    }, 1000)
    scheduleSync()
    onCleanup(() => {
      unsubscribe()
      window.removeEventListener("resize", scheduleSync)
      document.removeEventListener("scroll", scheduleSync, true)
      window.visualViewport?.removeEventListener("resize", scheduleSync)
      window.visualViewport?.removeEventListener("scroll", scheduleSync)
      if (safetyTimer !== undefined) window.clearInterval(safetyTimer)
      if (syncFrame !== undefined) cancelAnimationFrame(syncFrame)
      safetyTimer = undefined
      syncFrame = undefined
      if (moduleState.activeOwner === owner) {
        moduleState.activeOwner = undefined
        hide()
      }
    })
  })

  createEffect(() => {
    const element = placeholder()
    if (!element) return
    const observer = new ResizeObserver(scheduleSync)
    observer.observe(element)
    scheduleSync()
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    const visible = open()
    if (!browserPanelAPI()) return
    if (visible) {
      show()
      return
    }
    if (moduleState.activeOwner !== owner) return
    moduleState.activeOwner = undefined
    hide()
  })

  // The browser panel belongs to the session where it was opened. Keeping the
  // native view alive after a tab/session switch produced a page floating over
  // an unrelated conversation with an empty address bar.
  createEffect(() => {
    const key = props.sessionKey
    if (key === undefined) return
    if (moduleState.lastSessionKey === undefined) {
      moduleState.lastSessionKey = key
      return
    }
    if (moduleState.lastSessionKey === key) return
    moduleState.lastSessionKey = key
    closeBrowserPanel()
  })

  return (
    <Show when={isBrowserPanelAvailable() && open()}>
      <div
        role="region"
        aria-label={language.t("browser.panel.toggle")}
        classList={{
          "relative flex flex-col bg-v2-background-bg-base": true,
          "w-full h-[45%] min-h-[220px] shrink-0 border-b border-v2-border-border-base": !!props.stacked,
          "w-full flex-1 h-full min-h-0": !props.stacked,
        }}
      >
          <div class="relative flex items-center gap-2 border-b border-v2-border-base p-2">
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              disabled={!state().canGoBack}
              icon={<Icon name="chevron-left" />}
              aria-label={language.t("browser.panel.back")}
              onClick={() => browserPanelAPI()?.goBack()}
            />
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              disabled={!state().canGoForward}
              icon={<Icon name="chevron-right" />}
              aria-label={language.t("browser.panel.forward")}
              onClick={() => browserPanelAPI()?.goForward()}
            />
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              icon={<Icon name="reset" />}
              aria-label={language.t("browser.panel.reload")}
              onClick={() => browserPanelAPI()?.reload()}
            />
            <form
              class="flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                const value = addressInput().trim()
                if (!value) return
                const url = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`
                setEditingAddress(false)
                setAddressInput(url)
                const api = browserPanelAPI()
                if (api) {
                  void api.navigate(url)
                } else {
                  setState((prev) => ({ ...prev, url, title: url, isLoading: false }))
                }
              }}
            >
              <TextInputV2
                type="text"
                appearance="base"
                class="!w-full"
                value={addressInput()}
                aria-label={language.t("browser.panel.address.label")}
                placeholder={language.t("browser.panel.address.placeholder")}
                onFocus={() => setEditingAddress(true)}
                onBlur={() => {
                  setEditingAddress(false)
                  setAddressInput(state().url)
                }}
                onInput={(e) => setAddressInput(e.currentTarget.value)}
              />
            </form>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              icon={<Icon name="square-arrow-top-right" />}
              aria-label={language.t("common.openInNewTab") ?? "Open in new tab"}
              onClick={() => {
                if (state().url) window.open(state().url, "_blank", "noopener,noreferrer")
              }}
            />
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              icon={<Icon name="close" />}
              aria-label={language.t("common.close")}
              onClick={closeBrowserPanel}
            />
            <Show when={state().isLoading}>
              <div class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
                <div class="h-full w-1/3 animate-pulse rounded-full bg-v2-text-text-accent" />
              </div>
            </Show>
          </div>
          <span class="sr-only" role="status" aria-live="polite">
            {state().isLoading ? language.t("browser.panel.loading") : ""}
          </span>
          <Show when={visibleError()}>
            {(error) => (
              <div
                role="alert"
                aria-atomic="true"
                class="flex items-start gap-2 border-b border-v2-state-border-warning bg-v2-state-bg-warning px-2 py-2 text-v2-state-fg-warning"
              >
                <Icon name="warning" class="mt-0.5 shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="text-13-medium">{language.t("browser.panel.error.title")}</div>
                  <div class="text-12-regular">{language.t(browserPanelErrorKey(error().code))}</div>
                </div>
                <ButtonV2
                  type="button"
                  variant="ghost-muted"
                  size="small"
                  onClick={() => {
                    clearError()
                    void browserPanelAPI()?.reload()
                  }}
                >
                  {language.t("browser.panel.error.retry")}
                </ButtonV2>
                <IconButtonV2
                  type="button"
                  variant="ghost-muted"
                  size="small"
                  icon={<Icon name="close" />}
                  aria-label={language.t("browser.panel.error.dismiss")}
                  onClick={clearError}
                />
              </div>
            )}
          </Show>
          <div ref={setPlaceholder} aria-busy={state().isLoading} class="flex-1 min-h-0 relative">
            <Show when={!browserPanelAPI() && !!state().url}>
              <iframe
                src={state().url}
                class="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </Show>
          </div>
        </div>
    </Show>
  )
}
