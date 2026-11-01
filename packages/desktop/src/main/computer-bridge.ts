import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { randomBytes } from "node:crypto"
import { BrowserWindow } from "electron"
import { write as writeLog } from "./logging"
import {
  captureAccessibilitySnapshot,
  captureScreenshot,
  computerClick,
  computerKey,
  computerMove,
  computerScroll,
  computerType,
  resolveRef,
  stopComputerWorker,
} from "./computer-control"
import {
  showComputerOverlay,
  hideComputerOverlay,
  highlightOverlayElement,
  clearOverlayHighlight,
} from "./computer-overlay"
import { enterComputerUseCompactMode, exitComputerUseCompactMode } from "./windows"

let sessionResetTimer: NodeJS.Timeout | null = null
const INACTIVITY_TIMEOUT_MS = 25_000 // Volta ao normal se passar 25 segundos sem novas ações

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function notifySessionActivity() {
  const win = getActiveWindow()
  if (win) {
    enterComputerUseCompactMode(win)
  }
  showComputerOverlay()

  if (sessionResetTimer) {
    clearTimeout(sessionResetTimer)
  }
  sessionResetTimer = setTimeout(() => {
    endSession()
  }, INACTIVITY_TIMEOUT_MS)
}

function endSession() {
  if (sessionResetTimer) {
    clearTimeout(sessionResetTimer)
    sessionResetTimer = null
  }
  clearOverlayHighlight()
  hideComputerOverlay()
  stopComputerWorker()
  for (const win of BrowserWindow.getAllWindows()) {
    exitComputerUseCompactMode(win)
  }
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": data.length })
  res.end(data)
}

export type ComputerBridge = {
  port: number
  token: string
  stop(): void
}

/**
 * Same shape as browser-bridge.ts's HTTP bridge, but dispatching to OS-level
 * input (computer-control.ts) instead of a CDP-attached BrowserView — this
 * is the piece that lets the agent drive the whole desktop, not just the
 * embedded browser panel.
 */
export function startComputerBridge(): Promise<ComputerBridge> {
  const token = randomBytes(32).toString("hex")

  const server = createServer(async (req, res) => {
    try {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${token}`) {
        sendJson(res, 401, { error: "unauthorized" })
        return
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1")

      if (url.pathname === "/release" && req.method === "POST") {
        endSession()
        sendJson(res, 200, { ok: true })
        return
      }

      if (url.pathname === "/snapshot" && req.method === "GET") {
        notifySessionActivity()
        const snapshot = await captureAccessibilitySnapshot()
        sendJson(res, 200, { ok: true, data: snapshot })
        return
      }

      if (url.pathname === "/screenshot" && req.method === "GET") {
        notifySessionActivity()
        const png = await captureScreenshot()
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length })
        res.end(png)
        return
      }

      if (url.pathname === "/click" && req.method === "POST") {
        notifySessionActivity()
        const body = await readJson(req)
        if (body.ref) {
          const el = resolveRef(body.ref)
          if (el) {
            highlightOverlayElement(el.bounds, `${el.ref}: ${el.name || el.role}`)
          }
        } else if (typeof body.x === "number" && typeof body.y === "number") {
          highlightOverlayElement({ x: body.x - 10, y: body.y - 10, width: 20, height: 20 }, `(${body.x}, ${body.y})`)
        }
        const result = await computerClick({ ref: body.ref, x: body.x, y: body.y })
        sendJson(res, 200, result)
        return
      }

      if (url.pathname === "/move" && req.method === "POST") {
        notifySessionActivity()
        const body = await readJson(req)
        if (body.ref) {
          const el = resolveRef(body.ref)
          if (el) {
            highlightOverlayElement(el.bounds, `${el.ref}: ${el.name || el.role}`)
          }
        }
        const result = await computerMove({ ref: body.ref, x: body.x, y: body.y })
        sendJson(res, 200, result)
        return
      }

      if (url.pathname === "/type" && req.method === "POST") {
        notifySessionActivity()
        const body = await readJson(req)
        if (typeof body.text !== "string") throw new Error("text is required")
        if (body.ref) {
          const el = resolveRef(body.ref)
          if (el) {
            highlightOverlayElement(el.bounds, `${el.ref}: ${el.name || el.role}`)
          }
        }
        const result = await computerType({ text: body.text, ref: body.ref })
        sendJson(res, 200, result)
        return
      }

      if (url.pathname === "/key" && req.method === "POST") {
        notifySessionActivity()
        const body = await readJson(req)
        if (typeof body.key !== "string") throw new Error("key is required")
        const result = await computerKey(body.key)
        sendJson(res, 200, result)
        return
      }

      if (url.pathname === "/scroll" && req.method === "POST") {
        notifySessionActivity()
        const body = await readJson(req)
        if (body.ref) {
          const el = resolveRef(body.ref)
          if (el) {
            highlightOverlayElement(el.bounds, `${el.ref}: ${el.name || el.role}`)
          }
        }
        const result = await computerScroll(Number(body.deltaX ?? 0), Number(body.deltaY ?? 0), body.ref)
        sendJson(res, 200, result)
        return
      }

      sendJson(res, 404, { error: "not found" })
    } catch (error) {
      writeLog("computer-bridge", `request failed: ${String(error)}`, undefined, "error")
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("failed to determine computer bridge port"))
        return
      }
      resolve({
        port: address.port,
        token,
        stop: () => {
          endSession()
          server.close()
        },
      })
    })
  })
}
