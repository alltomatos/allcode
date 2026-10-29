import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, watch, type FSWatcher } from "node:fs"
import { join } from "node:path"
import { app } from "electron"
import { checkHealth } from "./server"

// Dev-only supervisor for the local server.
//
// `predev` builds `packages/allcode/dist/node`, and the packaged sidecar loads
// that bundle inside an Electron utility process. In development that means a
// source change only takes effect after a full `bun script/build-node.ts`
// (~20s) plus an app restart. This supervisor instead runs the server straight
// from TypeScript under Bun, watches the server-facing packages, and restarts
// the child process when they change: the port is released, the new instance
// boots from the edited source, and the renderer reconnects through its
// existing SSE/HTTP retry loop.

const DEBOUNCE_MS = 600
const STOP_TIMEOUT_MS = 5_000
const READY_TIMEOUT_MS = 120_000

const WATCHED = [
  "packages/allcode/src",
  "packages/core/src",
  "packages/schema/src",
  "packages/protocol/src",
  "packages/server/src",
]

export type DevServerOptions = {
  hostname: string
  port: number
  password: string
  env: Record<string, string>
  onStdout: (message: string) => void
  onStderr: (message: string) => void
}

export type DevServer = {
  listener: { stop: () => Promise<void> }
  health: { wait: Promise<void> }
}

export function devServerWatchDisabled() {
  const value = process.env.OPENCODE_DEV_SERVER_WATCH
  return value === "0" || value === "false"
}

/**
 * Starts the local server from source when running an unpackaged desktop build.
 * Returns `undefined` when the repo layout is unavailable so the caller can
 * fall back to the bundled utility-process sidecar.
 */
export function spawnDevSourceServer(options: DevServerOptions): DevServer | undefined {
  if (app.isPackaged || devServerWatchDisabled()) return undefined
  const desktopRoot = app.getAppPath()
  // packages/desktop -> repo root
  const repoRoot = join(desktopRoot, "..", "..")
  const entry = join(repoRoot, "packages", "allcode", "src", "index.ts")
  if (!existsSync(entry)) {
    options.onStderr(`[dev] server source not found at ${entry}; using the bundled sidecar`)
    return undefined
  }

  let child: ChildProcess | undefined
  const watchers: FSWatcher[] = []
  let stopping = false
  let restarting: Promise<void> | undefined
  let pending = false
  let timer: NodeJS.Timeout | undefined
  let readyResolve: (() => void) | undefined
  let readyReject: ((error: Error) => void) | undefined

  const health = {
    wait: new Promise<void>((resolve, reject) => {
      readyResolve = resolve
      readyReject = reject
    }),
  }

  const log = (message: string) => options.onStdout(`[dev] ${message}`)
  const fail = (message: string) => options.onStderr(`[dev] ${message}`)

  const start = async (reason: string) => {
    const startedAt = Date.now()
    const proc = spawn(
      process.env.OPENCODE_BUN ?? "bun",
      [
        "--conditions=browser",
        "packages/allcode/src/index.ts",
        "serve",
        "--port",
        String(options.port),
        "--hostname",
        options.hostname,
      ],
      {
        cwd: repoRoot,
        env: {
          ...options.env,
          OPENCODE_SERVER_USERNAME: "allcode",
          OPENCODE_SERVER_PASSWORD: options.password,
          OPENCODE_DEV_SERVER_WATCH: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    )
    child = proc
    log(`starting server from source (${reason})`)

    const forward = (stream: "out" | "err") => (chunk: Buffer) => {
      const text = chunk.toString("utf8").trimEnd()
      if (!text) return
      if (stream === "out") options.onStdout(text)
      else options.onStderr(text)
    }
    proc.stdout?.on("data", forward("out"))
    proc.stderr?.on("data", forward("err"))
    proc.once("exit", (code) => {
      if (child === proc) child = undefined
      if (!stopping) fail(`server from source exited with code ${code}; waiting for the next change`)
    })

    const url = `http://127.0.0.1:${options.port}`
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (!child) throw new Error("server from source exited before becoming healthy")
      if (await checkHealth(url, options.password)) {
        log(`server ready from source in ${Date.now() - startedAt}ms`)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    throw new Error(`server from source did not become healthy within ${READY_TIMEOUT_MS}ms`)
  }

  const killTree = async (proc: ChildProcess) => {
    if (proc.exitCode !== null || proc.signalCode !== null) return
    const exited = new Promise<void>((resolve) => proc.once("exit", () => resolve()))
    if (process.platform === "win32" && proc.pid) {
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
    } else {
      proc.kill("SIGTERM")
    }
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, STOP_TIMEOUT_MS))])
  }

  const restart = async (reason: string) => {
    if (restarting) {
      pending = true
      return restarting
    }
    restarting = (async () => {
      const current = child
      log(`reloading: ${reason}`)
      stopping = true
      if (current) await killTree(current)
      stopping = false
      try {
        await start(reason)
        log("reload finished")
      } catch (error) {
        fail(`reload failed: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      } finally {
        restarting = undefined
        if (pending) {
          pending = false
          void restart("pending change")
        }
      }
    })()
    return restarting
  }

  const onChange = (event: string, filename: string | null) => {
    if (!filename) return
    const normalized = filename.replaceAll("\\", "/")
    if (normalized.includes("node_modules") || normalized.includes("/.git/") || normalized.includes("/dist/")) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void restart(`${event} ${normalized}`).catch(() => {})
    }, DEBOUNCE_MS)
  }

  for (const dir of WATCHED) {
    const path = join(repoRoot, dir)
    if (!existsSync(path)) continue
    watchers.push(watch(path, { recursive: true }, onChange))
  }

  void start("initial boot")
    .then(() => readyResolve?.())
    .catch((error) => readyReject?.(error instanceof Error ? error : new Error(String(error))))

  return {
    listener: {
      stop: async () => {
        stopping = true
        clearTimeout(timer)
        for (const watcher of watchers.splice(0)) watcher.close()
        if (child) await killTree(child)
      },
    },
    health,
  }
}
