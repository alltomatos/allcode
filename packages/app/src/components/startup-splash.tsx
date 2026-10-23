import { Splash } from "@allcode/ui/logo"
import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import type { AppReadiness, ReadinessSnapshot } from "@/startup/readiness"

export type StartupSplashCopy = {
  title: string
  progress: (completed: number, total: number) => string
  starting: (service: string) => string
  errorTitle: string
  errorDescription: string
  details: string
  retry: string
  logs: string
  optional: string
  optionalWarning: (service: string) => string
}

export type SplashPhase = "loading" | "error" | "leaving" | "dismissed"

/** Pure gate used by the component and by tests. */
export function splashPhase(snapshot: ReadinessSnapshot, leaving: boolean, dismissed: boolean): SplashPhase {
  if (dismissed) return "dismissed"
  if (snapshot.failed) return "error"
  if (snapshot.allReady) return leaving ? "leaving" : "loading"
  return "loading"
}

const FADE_MS = 300

export function StartupSplash(props: {
  readiness: AppReadiness
  copy: StartupSplashCopy
  errorExtra?: JSX.Element
  onExportLogs?: () => void | Promise<unknown>
}) {
  const [leaving, setLeaving] = createSignal(false)
  const [dismissed, setDismissed] = createSignal(false)
  const [showDetails, setShowDetails] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    const snapshot = props.readiness.snapshot()
    if (!snapshot.allReady) {
      setLeaving(false)
      return
    }
    if (leaving() || dismissed()) return
    setLeaving(true)
    timer = setTimeout(() => setDismissed(true), FADE_MS)
  })

  onCleanup(() => {
    if (timer) clearTimeout(timer)
  })

  const phase = () => splashPhase(props.readiness.snapshot(), leaving(), dismissed())
  const snapshot = () => props.readiness.snapshot()
  const failed = () => snapshot().services.filter((service) => service.status === "failed")
  const percent = () => {
    if (snapshot().total === 0) return 100
    return Math.round((snapshot().completed / snapshot().total) * 100)
  }
  const currentLabel = () => {
    const current = snapshot().current
    if (!current) return props.copy.starting("...")
    return props.copy.starting(current.label)
  }

  return (
    <Show when={phase() !== "dismissed"}>
      <div
        role="status"
        aria-live="polite"
        data-splash-phase={phase()}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget) return
          if (leaving()) setDismissed(true)
        }}
        class="fixed inset-0 z-[9999] flex h-dvh w-screen flex-col items-center justify-center bg-background-base p-6 text-center select-none transition-opacity duration-300"
        classList={{ "opacity-0 pointer-events-none": leaving() }}
      >
        <div classList={{ "animate-pulse": phase() === "loading" }}>
          <Splash class="w-16 h-20" />
        </div>

        <Show when={phase() !== "error" && phase() !== "dismissed"}>
          <div class="mt-6 flex w-full max-w-sm flex-col items-center gap-3">
            <h1 class="text-16-medium text-text-strong">{props.copy.title}</h1>
            <p class="text-12-regular text-text-weak">{currentLabel()}</p>
            <div
              class="h-1 w-full overflow-hidden rounded-full bg-surface-raised-base"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={snapshot().total}
              aria-valuenow={snapshot().completed}
            >
              <div
                class="h-full rounded-full bg-text-strong transition-[width] duration-300"
                style={{ width: `${percent()}%` }}
              />
            </div>
            <p class="text-12-regular text-text-weak">{props.copy.progress(snapshot().completed, snapshot().total)}</p>
            <ul class="mt-2 flex w-full flex-col gap-1 text-left">
              <For each={snapshot().services}>
                {(service) => (
                  <li class="flex items-center gap-2 text-12-regular">
                    <span
                      class="size-1.5 rounded-full"
                      classList={{
                        "bg-text-strong": service.status === "ready",
                        "bg-text-weak animate-pulse": service.status === "running",
                        "bg-surface-raised-base": service.status === "pending",
                        "bg-icon-critical-base": service.status === "failed",
                      }}
                    />
                    <span classList={{ "text-text-strong": service.status === "ready", "text-text-weak": true }}>
                      {service.label}
                    </span>
                    <Show when={service.optional}>
                      <span class="text-12-regular text-text-weak">({props.copy.optional})</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
            <Show when={snapshot().warnings.length > 0}>
              <p class="text-12-regular text-icon-warning-base">
                {props.copy.optionalWarning(
                  snapshot()
                    .warnings.map((service) => service.label)
                    .join(", "),
                )}
              </p>
            </Show>
          </div>
        </Show>

        <Show when={phase() === "error"}>
          <div class="mt-6 flex w-full max-w-md flex-col items-center gap-4">
            <h1 class="text-16-medium text-text-strong">{props.copy.errorTitle}</h1>
            <p class="text-12-regular text-text-weak">{props.copy.errorDescription}</p>
            <ul class="flex w-full flex-col gap-2 rounded-lg bg-surface-base p-3 text-left">
              <For each={failed()}>
                {(service) => (
                  <li class="flex flex-col gap-0.5">
                    <span class="text-12-medium text-text-strong">{service.label}</span>
                    <Show when={service.error}>
                      <span class="text-12-regular text-text-weak break-words">{service.error}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                class="rounded-md bg-text-strong px-4 py-2 text-12-medium text-background-base transition-opacity hover:opacity-90"
                onClick={() => void props.readiness.retryFailed()}
              >
                {props.copy.retry}
              </button>
              <Show when={props.onExportLogs}>
                <button
                  type="button"
                  class="rounded-md border border-border-weak-base px-4 py-2 text-12-medium text-text-strong transition-colors hover:bg-surface-raised-base"
                  onClick={() => void props.onExportLogs?.()}
                >
                  {props.copy.logs}
                </button>
              </Show>
              <button
                type="button"
                class="rounded-md px-3 py-2 text-12-regular text-text-weak underline-offset-2 transition-colors hover:text-text-strong hover:underline"
                onClick={() => setShowDetails((value) => !value)}
              >
                {props.copy.details}
              </button>
            </div>
            <Show when={showDetails()}>
              <ul class="flex w-full flex-col gap-2 rounded-lg bg-surface-base p-3 text-left">
                <For each={failed()}>
                  {(service) => (
                    <li class="text-12-regular text-text-weak break-words">
                      <span class="text-text-strong">{service.label}: </span>
                      {service.error}
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            {props.errorExtra}
          </div>
        </Show>
      </div>
    </Show>
  )
}
