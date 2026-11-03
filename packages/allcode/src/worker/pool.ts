import { availableParallelism, cpus } from "node:os"
import { Worker } from "node:worker_threads"
import { Effect } from "effect"

/**
 * Offloads self-contained CPU-bound functions to a small `worker_threads`
 * pool. The function is serialized with `Function.prototype.toString()`, so it
 * must not reference module-scope helpers — every dependency has to live inside
 * the function body (globals like `JSON` are available).
 *
 * If workers are unavailable (disabled, unsupported runtime, spawn failure) the
 * task runs inline, so callers never lose correctness — only the isolation.
 */

const WORKER_SOURCE = `
const { parentPort } = require("node:worker_threads")
const cache = new Map()
parentPort.on("message", (message) => {
  if (message.type === "close") {
    process.exit(0)
    return
  }
  const { id, source, input } = message
  try {
    let fn = cache.get(source)
    if (!fn) {
      fn = (0, eval)("(" + source + ")")
      cache.set(source, fn)
    }
    parentPort.postMessage({ id, ok: true, value: fn(input) })
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: String((error && error.stack) || error) })
  }
})
`

const DEFAULT_TIMEOUT = 30_000

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type QueueItem = {
  source: string
  input: unknown
  pending: Pending
}

type Slot = {
  worker: Worker
  current?: Pending
}

class Pool {
  private slots = new Map<Worker, Slot>()
  private idle: Worker[] = []
  private queue: QueueItem[] = []
  private nextId = 1
  private disabled = false

  constructor(private readonly maximum: number) {}

  run<I, O>(task: (input: I) => O, input: I, timeout = DEFAULT_TIMEOUT): Promise<O> {
    if (this.disabled || process.env.OPENCODE_WORKER_POOL === "0") return Promise.resolve(task(input))
    return new Promise<O>((resolve, reject) => {
      const pending: Pending = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
      }
      const item: QueueItem = { source: task.toString(), input, pending }
      pending.timer = setTimeout(() => {
        const index = this.queue.indexOf(item)
        if (index !== -1) this.queue.splice(index, 1)
        pending.reject(new Error(`Worker task timed out after ${timeout}ms`))
        pending.reject = () => {}
      }, timeout)
      pending.timer.unref?.()
      this.queue.push(item)
      this.pump()
    })
  }

  private pump() {
    while (this.queue.length > 0) {
      const worker = this.idle.pop() ?? this.spawn()
      if (!worker) return
      const item = this.queue.shift()!
      const slot = this.slots.get(worker)
      if (!slot) {
        this.queue.unshift(item)
        continue
      }
      slot.current = item.pending
      worker.ref()
      worker.postMessage({ id: this.nextId++, source: item.source, input: item.input })
    }
  }

  private spawn(): Worker | undefined {
    if (this.slots.size >= this.maximum) return undefined
    let worker: Worker
    try {
      worker = new Worker(WORKER_SOURCE, { eval: true })
    } catch {
      this.disabled = true
      return undefined
    }
    worker.unref()
    const slot: Slot = { worker }
    this.slots.set(worker, slot)
    worker.on("message", (message: { id: number; ok: boolean; value?: unknown; error?: string }) => {
      const pending = slot.current
      slot.current = undefined
      if (pending) {
        clearTimeout(pending.timer)
        if (message.ok) pending.resolve(message.value)
        else pending.reject(new Error(message.error ?? "Worker task failed"))
      }
      this.idle.push(worker)
      worker.unref()
      this.pump()
    })
    worker.on("error", (error) => this.fail(worker, error))
    worker.on("exit", () => this.remove(worker))
    return worker
  }

  private fail(worker: Worker, error: Error) {
    const slot = this.slots.get(worker)
    if (slot?.current) {
      clearTimeout(slot.current.timer)
      slot.current.reject(error)
    }
    this.remove(worker)
  }

  private remove(worker: Worker) {
    this.slots.delete(worker)
    this.idle = this.idle.filter((item) => item !== worker)
    if (!this.disabled) this.pump()
  }

  close() {
    this.disabled = true
    for (const [worker, slot] of this.slots) {
      if (slot.current) {
        clearTimeout(slot.current.timer)
        slot.current.reject(new Error("Worker pool closed"))
      }
      void worker.terminate()
    }
    this.slots.clear()
    this.idle = []
    for (const item of this.queue.splice(0)) {
      clearTimeout(item.pending.timer)
      item.pending.reject(new Error("Worker pool closed"))
    }
  }
}

let pool: Pool | undefined

function getPool() {
  const cores = typeof availableParallelism === "function" ? availableParallelism() : cpus().length
  pool ??= new Pool(Math.max(1, Math.min(4, cores - 1)))
  return pool
}

export function run<I, O>(task: (input: I) => O, input: I, timeout?: number): Promise<O> {
  return getPool().run(task, input, timeout)
}

export function close() {
  pool?.close()
  pool = undefined
}

/**
 * Token estimation of a JSON payload, computed off the main thread. Kept
 * self-contained so it can be serialized into a worker.
 */
export const estimateJsonTokens = (value: unknown) => {
  const text = JSON.stringify(value) ?? ""
  return Math.max(0, Math.round(text.length / 4))
}

export const estimateJsonTokensEffect = (value: unknown): Effect.Effect<number> =>
  Effect.tryPromise({
    try: () => run(estimateJsonTokens, value),
    catch: (error) => new Error(String(error)),
  }).pipe(Effect.orElseSucceed(() => estimateJsonTokens(value)))

export * as WorkerPool from "./pool"
