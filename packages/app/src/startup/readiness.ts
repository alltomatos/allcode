import { createSignal } from "solid-js"

export const DEFAULT_READINESS_TIMEOUT_MS = 30_000

export type ReadinessStatus = "pending" | "running" | "ready" | "failed"

export type ReadinessService = {
  /** Stable identifier used for logging, retries and tests. */
  id: string
  /** Already-localized human readable service name shown by the splash. */
  label: string
  /** Optional services never block the splash; failures are surfaced as warnings. */
  optional?: boolean
  /** Per-service timeout. Defaults to DEFAULT_READINESS_TIMEOUT_MS. */
  timeoutMs?: number
  /**
   * Resolves when the service is operational. Reject to report a failure.
   * The signal aborts on timeout or when the manager is disposed.
   */
  ready: (signal: AbortSignal) => unknown
}

export type ServiceReadiness = {
  id: string
  label: string
  optional: boolean
  status: ReadinessStatus
  error?: string
}

export type ReadinessSnapshot = {
  services: readonly ServiceReadiness[]
  started: boolean
  allReady: boolean
  failed: boolean
  completed: number
  total: number
  current: ServiceReadiness | undefined
  warnings: readonly ServiceReadiness[]
}

export type ReadinessLogger = {
  info: (message: string, data?: unknown) => void
  warn: (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
}

export type AppReadiness = ReturnType<typeof createReadinessManager>

export class ReadinessTimeoutError extends Error {
  constructor(service: ReadinessService, timeoutMs: number) {
    super(`${service.label} did not become ready within ${timeoutMs}ms`)
    this.name = "ReadinessTimeoutError"
  }
}

type RunOptions = {
  /** Only run the given services. Used by retry so ready services are not restarted. */
  only?: ReadonlySet<string>
}

const consoleLogger: ReadinessLogger = {
  info: (message, data) => console.info(`[startup] ${message}`, data ?? ""),
  warn: (message, data) => console.warn(`[startup] ${message}`, data ?? ""),
  error: (message, data) => console.error(`[startup] ${message}`, data ?? ""),
}

export type ReadinessController = {
  getSnapshot: () => ReadinessSnapshot
  subscribe: (listener: (snapshot: ReadinessSnapshot) => void) => () => void
  start: () => Promise<void>
  retryFailed: () => Promise<void>
  dispose: () => void
}

/**
 * Framework-agnostic readiness aggregation.
 *
 * - Optional services never block `allReady`; their failures are reported as warnings.
 * - Each service gets an explicit timeout and an AbortSignal (no fixed sleeps).
 * - `start` is idempotent and `retryFailed` only re-runs services that failed.
 */
export function createReadinessController(
  services: ReadinessService[],
  options?: { defaultTimeoutMs?: number; logger?: ReadinessLogger },
): ReadinessController {
  const ids = new Set<string>()
  for (const service of services) {
    if (ids.has(service.id)) throw new Error(`duplicate readiness service: ${service.id}`)
    ids.add(service.id)
  }

  const logger = options?.logger ?? consoleLogger
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS
  const items: ServiceReadiness[] = services.map((service) => ({
    id: service.id,
    label: service.label,
    optional: service.optional === true,
    status: "pending",
  }))
  const attempts = new Map<string, number>()
  const controllers = new Map<string, AbortController>()
  const listeners = new Set<(snapshot: ReadinessSnapshot) => void>()
  let started = false
  let disposed = false

  const getSnapshot = (): ReadinessSnapshot => {
    const completed = items.filter((item) => item.status === "ready").length
    return {
      services: items.slice(),
      started,
      allReady: items.every((item) => item.optional || item.status === "ready"),
      failed: items.some((item) => !item.optional && item.status === "failed"),
      completed,
      total: items.length,
      current: items.find((item) => item.status === "running") ?? items.find((item) => item.status === "pending"),
      warnings: items.filter((item) => item.optional && item.status === "failed"),
    }
  }

  const emit = () => {
    const snapshot = getSnapshot()
    for (const listener of listeners) listener(snapshot)
  }

  const update = (id: string, patch: Partial<ServiceReadiness>) => {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return
    items[index] = { ...items[index], ...patch }
    emit()
  }

  const timeoutFor = (service: ReadinessService) => service.timeoutMs ?? defaultTimeoutMs

  async function execute(service: ReadinessService) {
    const attempt = (attempts.get(service.id) ?? 0) + 1
    attempts.set(service.id, attempt)
    const controller = new AbortController()
    controllers.set(service.id, controller)
    const timeoutMs = timeoutFor(service)
    logger.info(`waiting for ${service.id}`, { timeoutMs, optional: service.optional === true })
    update(service.id, { status: "running", error: undefined })

    const timer = setTimeout(() => {
      controller.abort(new ReadinessTimeoutError(service, timeoutMs))
    }, timeoutMs)

    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          const reason = controller.signal.reason
          reject(reason instanceof Error ? reason : new ReadinessTimeoutError(service, timeoutMs))
        },
        { once: true },
      )
    })

    try {
      await Promise.race([Promise.resolve().then(() => service.ready(controller.signal)), aborted])
      if (disposed || attempts.get(service.id) !== attempt) return
      update(service.id, { status: "ready", error: undefined })
      logger.info(`${service.id} ready`)
    } catch (error) {
      if (disposed || attempts.get(service.id) !== attempt) return
      const message = error instanceof Error ? error.message : String(error)
      update(service.id, { status: "failed", error: message })
      if (service.optional) {
        logger.warn(`${service.id} failed (optional)`, { error: message })
        return
      }
      logger.error(`${service.id} failed`, { error: message })
    } finally {
      clearTimeout(timer)
      controllers.delete(service.id)
    }
  }

  async function run(opts?: RunOptions) {
    if (disposed) return
    const selected = services.filter((service) => {
      if (!opts?.only) return true
      if (!opts.only.has(service.id)) return false
      const item = items.find((entry) => entry.id === service.id)
      return item?.status === "failed" || item?.status === "pending"
    })
    if (selected.length === 0) return
    await Promise.all(selected.map((service) => execute(service)))
  }

  async function start() {
    if (started || disposed) return
    started = true
    emit()
    await run()
  }

  async function retryFailed() {
    if (disposed) return
    const failed = items.filter((item) => item.status === "failed").map((item) => item.id)
    if (failed.length === 0) return
    logger.info("retrying failed services", { services: failed })
    await run({ only: new Set(failed) })
  }

  function dispose() {
    if (disposed) return
    disposed = true
    for (const controller of controllers.values()) {
      controller.abort(new Error("readiness manager disposed"))
    }
    controllers.clear()
    listeners.clear()
  }

  return {
    getSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start,
    retryFailed,
    dispose,
  }
}

/**
 * Solid adapter for the readiness controller. The snapshot is a signal that is
 * pushed on every state change so components never need a memo to observe it.
 */
export function createReadinessManager(
  services: ReadinessService[],
  options?: { defaultTimeoutMs?: number; logger?: ReadinessLogger },
) {
  const controller = createReadinessController(services, options)
  const [snapshot, setSnapshot] = createSignal(controller.getSnapshot())
  const unsubscribe = controller.subscribe(setSnapshot)

  return {
    snapshot,
    start: controller.start,
    retryFailed: controller.retryFailed,
    allReady: () => snapshot().allReady,
    failed: () => snapshot().failed,
    dispose: () => {
      unsubscribe()
      controller.dispose()
    },
  }
}
