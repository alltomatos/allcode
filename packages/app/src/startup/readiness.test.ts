import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createReadinessManager, ReadinessTimeoutError, type ReadinessService } from "./readiness"

function manager(services: ReadinessService[], options?: { defaultTimeoutMs?: number }) {
  return createRoot((disposeRoot) => {
    const readiness = createReadinessManager(services, {
      ...options,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    })
    return {
      readiness,
      dispose: () => {
        readiness.dispose()
        disposeRoot()
      },
    }
  })
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("readiness manager", () => {
  test("only reports allReady after every required service resolves", async () => {
    const gate = deferred()
    const { readiness, dispose } = manager([
      { id: "fast", label: "Fast", ready: () => Promise.resolve() },
      { id: "slow", label: "Slow", ready: () => gate.promise },
    ])

    const starting = readiness.start()
    await tick()
    expect(readiness.allReady()).toBe(false)
    expect(readiness.snapshot().completed).toBe(1)
    expect(readiness.snapshot().current?.id).toBe("slow")

    gate.resolve()
    await starting
    expect(readiness.allReady()).toBe(true)
    expect(readiness.snapshot().completed).toBe(2)
    dispose()
  })

  test("reports a required service failure and keeps the gate closed", async () => {
    const { readiness, dispose } = manager([
      { id: "ok", label: "Ok", ready: () => Promise.resolve() },
      { id: "bad", label: "Bad", ready: () => Promise.reject(new Error("boom")) },
    ])

    await readiness.start()
    const snapshot = readiness.snapshot()
    expect(snapshot.failed).toBe(true)
    expect(snapshot.allReady).toBe(false)
    expect(snapshot.services.find((service) => service.id === "bad")?.status).toBe("failed")
    expect(snapshot.services.find((service) => service.id === "bad")?.error).toBe("boom")
    dispose()
  })

  test("fails a service that exceeds its timeout and aborts it", async () => {
    let aborted = false
    const { readiness, dispose } = manager(
      [
        {
          id: "stuck",
          label: "Stuck",
          timeoutMs: 20,
          ready: (signal) =>
            new Promise((_, reject) => {
              signal.addEventListener(
                "abort",
                () => {
                  aborted = true
                  reject(signal.reason)
                },
                { once: true },
              )
            }),
        },
      ],
      { defaultTimeoutMs: 20 },
    )

    await readiness.start()
    const service = readiness.snapshot().services[0]
    expect(aborted).toBe(true)
    expect(service?.status).toBe("failed")
    expect(service?.error).toContain("did not become ready")
    expect(readiness.allReady()).toBe(false)
    expect(readiness.snapshot().failed).toBe(true)
    expect(new ReadinessTimeoutError({ id: "x", label: "X", ready: () => {} }, 20)).toBeInstanceOf(Error)
    dispose()
  })

  test("retryFailed re-runs only the failed services", async () => {
    const runs: string[] = []
    let flakyAttempts = 0
    const { readiness, dispose } = manager([
      {
        id: "stable",
        label: "Stable",
        ready: () => {
          runs.push("stable")
          return Promise.resolve()
        },
      },
      {
        id: "flaky",
        label: "Flaky",
        ready: () => {
          runs.push("flaky")
          flakyAttempts += 1
          return flakyAttempts === 1 ? Promise.reject(new Error("first try")) : Promise.resolve()
        },
      },
    ])

    await readiness.start()
    expect(readiness.allReady()).toBe(false)
    expect(runs.filter((entry) => entry === "stable")).toHaveLength(1)

    await readiness.retryFailed()
    expect(runs.filter((entry) => entry === "stable")).toHaveLength(1)
    expect(runs.filter((entry) => entry === "flaky")).toHaveLength(2)
    expect(readiness.allReady()).toBe(true)
    expect(readiness.snapshot().failed).toBe(false)
    dispose()
  })

  test("optional failures become warnings without blocking allReady", async () => {
    const { readiness, dispose } = manager([
      { id: "required", label: "Required", ready: () => Promise.resolve() },
      { id: "optional", label: "Optional", optional: true, ready: () => Promise.reject(new Error("offline")) },
    ])

    await readiness.start()
    const snapshot = readiness.snapshot()
    expect(snapshot.failed).toBe(false)
    expect(snapshot.allReady).toBe(true)
    expect(snapshot.warnings.map((service) => service.id)).toEqual(["optional"])
    expect(snapshot.warnings[0]?.error).toBe("offline")
    dispose()
  })

  test("start is idempotent and dispose aborts in-flight services", async () => {
    let runs = 0
    let aborted = false
    const { readiness, dispose } = manager([
      {
        id: "pending",
        label: "Pending",
        timeoutMs: 5_000,
        ready: (signal) => {
          runs += 1
          return new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              aborted = true
              reject(signal.reason)
            })
          })
        },
      },
    ])

    void readiness.start()
    void readiness.start()
    await tick()
    expect(runs).toBe(1)
    dispose()
    await tick()
    expect(aborted).toBe(true)
  })
})
