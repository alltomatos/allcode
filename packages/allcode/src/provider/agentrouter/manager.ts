import fs from "fs/promises"
import path from "path"
import { Global } from "@allcode/core/global"
import { Process } from "@/util/process"
import { resolvePortablePython } from "./python"
import { RELAY_PY_SOURCE } from "./relay-source"

export const DEFAULT_PORT = 7187

// Must match RELAY_VERSION in relay.py / relay-source.ts. Bumping it makes the
// manager restart an older relay that was left running by a previous app
// process instead of silently reusing code that lacks the latest fixes.
export const RELAY_VERSION = 2

// Written out from an embedded string (relay-source.ts), not resolved via
// import.meta.dirname — the packaged desktop app bundles this module into
// out/main/chunks/*.js inside app.asar, and a co-located relay.py never
// makes it into that bundle, so a path-based lookup 404s at runtime.
async function relayScriptPath(): Promise<string> {
  const dest = path.join(Global.Path.bin, "agentrouter-relay.py")
  await fs.writeFile(dest, RELAY_PY_SOURCE)
  return dest
}

export class AgentRouterRelayError extends Error {}

interface RelayHandle {
  baseURL: string
}

// Dedup within this opencode process — the provider loader can run more than
// once (e.g. re-init), so don't spawn a second relay while one is starting.
let starting: Promise<RelayHandle> | undefined

export async function ensureRelay(apiKey: string, port = DEFAULT_PORT, retry = true): Promise<RelayHandle> {
  if (!starting) {
    starting = start(apiKey, port).catch((err) => {
      starting = undefined
      throw err
    })
  }
  const handle = await starting
  // A resolved handle can still point at a relay that died or hung after
  // startup. Re-check before handing it to the caller so a stale listener is
  // reclaimed instead of failing every AgentRouter request until restart.
  if (await healthy(handle.baseURL, 800)) return handle
  starting = undefined
  if (retry) return ensureRelay(apiKey, port, false)
  throw new AgentRouterRelayError("AgentRouter relay stopped responding.")
}

async function healthy(baseURL: string, timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`${baseURL}/health`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean; version?: number }
    return body.ok === true && body.version === RELAY_VERSION
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function parseWindowsNetstat(output: string, port: number): number | undefined {
  for (const line of output.split(/\r?\n/)) {
    const match = /\s+TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i.exec(line)
    if (!match) continue
    if (Number(match[1]) === port) return Number(match[2])
  }
  return undefined
}

async function listenerPid(port: number): Promise<number | undefined> {
  if (process.platform === "win32") {
    const out = await Process.run(["netstat", "-ano", "-p", "tcp"], { nothrow: true })
    return parseWindowsNetstat(out.stdout.toString(), port)
  }
  const out = await Process.run(["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"], { nothrow: true })
  const pid = Number.parseInt(out.stdout.toString().trim().split(/\r?\n/)[0] ?? "", 10)
  return Number.isFinite(pid) ? pid : undefined
}

/**
 * A relay orphaned by a previous app process can keep port 7187 in LISTEN
 * state while no longer answering /health (for example after its parent's
 * stderr pipe closed). Binding a new relay to that port then fails or hangs
 * forever. If the port is held but the relay is not healthy, terminate the
 * stale listener so the next spawn can own the port.
 */
async function processCommand(pid: number): Promise<string | undefined> {
  const out =
    process.platform === "win32"
      ? await Process.run(
          [
            "powershell",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
          ],
          { nothrow: true },
        )
      : await Process.run(["ps", "-p", String(pid), "-o", "command="], { nothrow: true })
  if (out.code !== 0) return undefined
  return out.stdout.toString().trim() || undefined
}

async function reclaimPort(port: number): Promise<void> {
  const pid = await listenerPid(port)
  if (!pid || pid === process.pid) return
  // Never kill an unrelated process that happens to use the relay port.
  const command = await processCommand(pid)
  if (command !== undefined && !command.includes("agentrouter-relay.py")) return

  if (process.platform === "win32") {
    await Process.run(["taskkill", "/pid", String(pid), "/T", "/F"], { nothrow: true })
  } else {
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    if (!(await listenerPid(port))) return
    await sleep(100)
  }
}

async function hasWorkingPip(bin: string): Promise<boolean> {
  const out = await Process.run([bin, "-m", "pip", "--version"], { nothrow: true })
  return out.code === 0
}

async function hasAnthropic(bin: string): Promise<boolean> {
  const out = await Process.run([bin, "-c", "import anthropic"], { nothrow: true })
  return out.code === 0
}

// Windows commonly has multiple `python3`/`python` on PATH — Git Bash/MSYS2's
// stripped-down interpreter (no pip module) frequently sorts ahead of the
// real installation. Accepting the first one that merely answers `--version`
// silently breaks the relay later at pip-install time. Walk every candidate
// and pick the first that's actually usable (already has anthropic, or has a
// working pip to install it with). If nothing on PATH clears that bar,
// download a portable CPython (python.ts) instead of guessing further —
// this is what makes AgentRouter work without depending on the system at all.
async function findPython(): Promise<string> {
  const candidates = ["python3", "python", "py -3"]
  const withPip: string[] = []

  // Prefer an interpreter that already has the package. On Windows the first
  // `python`/`python3` on PATH is often an MSYS2 or uv-managed installation
  // with no pip (or a PEP 668 lock), while the `py` launcher points at a
  // perfectly usable interpreter that already has `anthropic`. Returning the
  // first pip-capable candidate caused a hard "externally managed
  // environment" failure even though a working Python existed.
  for (const bin of candidates) {
    const parts = bin.split(" ")
    const out = await Process.run([...parts, "--version"], { nothrow: true })
    if (out.code !== 0) continue
    if (await hasAnthropic(bin)) return bin
    if (await hasWorkingPip(bin)) withPip.push(bin)
  }

  return withPip[0] ?? resolvePortablePython()
}

async function ensureAnthropicPackage(python: string): Promise<string> {
  if (await hasAnthropic(python)) return python
  const parts = python.split(" ")
  const install = await Process.run([...parts, "-m", "pip", "install", "--quiet", "anthropic"], { nothrow: true })
  if (install.code === 0) return python

  // Never modify an externally-managed (PEP 668 / uv-managed) interpreter.
  // Fall back to our own portable CPython, which has a writable pip.
  const portable = await resolvePortablePython()
  if (portable === python) {
    throw new AgentRouterRelayError(
      `Failed to install the Python "anthropic" package needed by the AgentRouter relay (tried "${python}"):\n${install.stderr.toString().trim()}`,
    )
  }
  if (await hasAnthropic(portable)) return portable
  const retry = await Process.run(
    [...portable.split(" "), "-m", "pip", "install", "--quiet", "anthropic"],
    { nothrow: true },
  )
  if (retry.code !== 0) {
    throw new AgentRouterRelayError(
      `Failed to install the Python "anthropic" package needed by the AgentRouter relay (tried "${python}" and "${portable}"):\n${retry.stderr.toString().trim()}`,
    )
  }
  return portable
}

async function start(apiKey: string, port: number): Promise<RelayHandle> {
  const baseURL = `http://127.0.0.1:${port}`

  if (await healthy(baseURL)) return { baseURL }

  // Give an already-starting relay a short grace period before treating the
  // listener as stale (cold Python starts can take a few seconds).
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(200)
    if (await healthy(baseURL, 500)) return { baseURL }
  }
  await reclaimPort(port)

  const python = await ensureAnthropicPackage(await findPython())
  const relayScript = await relayScriptPath()

  const child = Process.spawn([...python.split(" "), relayScript], {
    env: { AGENTROUTER_API_KEY: apiKey, AGENTROUTER_PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  })

  let stdout = ""
  let stderr = ""
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString()
  })

  child.exited.then((code) => {
    if (code !== 0) starting = undefined
  })

  // Cold start includes downloading/loading Python and importing `anthropic`
  // on Windows. 20 x 500ms (the previous budget) was too short and surfaced as
  // a misleading "did not become healthy" error with no diagnostics.
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new AgentRouterRelayError(
        `AgentRouter relay exited early (code ${child.exitCode}):\n${stdout.trim()}\n${stderr.trim()}`.trim(),
      )
    }
    if (await healthy(baseURL, 500)) return { baseURL }
    await sleep(500)
  }

  await Process.stop(child)
  throw new AgentRouterRelayError(
    `AgentRouter relay did not become healthy in time:\n${stdout.trim()}\n${stderr.trim()}`.trim(),
  )
}

