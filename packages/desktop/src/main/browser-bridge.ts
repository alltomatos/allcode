import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { randomBytes } from "node:crypto"
import type { BrowserPanel } from "./browser-panel"
import { flattenAXTree } from "./browser-snapshot"
import { write as writeLog } from "./logging"

const snapshotRefs = new Map<string, Map<string, number>>()

class BridgeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => {
      if (!chunks.length) return resolve({})
      try {
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        if (!isRecord(value)) {
          reject(new BridgeError(400, "invalid_body", "The request body must be a JSON object."))
          return
        }
        resolve(value)
      } catch {
        reject(new BridgeError(400, "invalid_json", "The request body is not valid JSON."))
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

function sendError(res: ServerResponse, error: BridgeError) {
  sendJson(res, error.status, { error: { code: error.code, message: error.message } })
}

function requireUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BridgeError(400, "invalid_url", "A URL is required for this action.")
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BridgeError(400, "invalid_url", "That URL is not valid. Include the scheme, for example https://example.com.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BridgeError(400, "unsupported_scheme", "Only http and https URLs can be opened in the browser panel.")
  }
  return url.toString()
}

function requireFinite(value: unknown, name: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BridgeError(400, "invalid_coordinate", `${name} must be a finite number.`)
  }
  return value
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.length) {
    throw new BridgeError(400, "invalid_parameter", `${name} is required for this action.`)
  }
  return value
}

const KEY_CODES: Record<string, number> = {
  Enter: 13,
  Tab: 9,
  Escape: 27,
  Backspace: 8,
  Delete: 46,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Home: 36,
  End: 35,
  PageUp: 33,
  PageDown: 34,
}

function keyEvent(key: string): Record<string, unknown> {
  const code = KEY_CODES[key]
  const event: Record<string, unknown> = { key, code: key }
  if (code !== undefined) {
    event.windowsVirtualKeyCode = code
    event.nativeVirtualKeyCode = code
  }
  if (key === "Enter") {
    event.text = "\r"
    event.unmodifiedText = "\r"
  } else if (key === "Tab") {
    event.text = "\t"
    event.unmodifiedText = "\t"
  } else if (key.length === 1) {
    event.text = key
    event.unmodifiedText = key
  }
  return event
}

function toBridgeError(error: unknown): BridgeError {
  if (error instanceof BridgeError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("ERR_ABORTED")) {
    return new BridgeError(409, "navigation_cancelled", "The navigation was cancelled. Try again.")
  }
  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return new BridgeError(422, "name_not_resolved", "That address could not be resolved. Check the URL and try again.")
  }
  if (message.includes("ERR_INTERNET_DISCONNECTED")) {
    return new BridgeError(503, "offline", "The browser appears to be offline. Check the connection and try again.")
  }
  if (message.includes("ERR_TIMED_OUT") || message.includes("ERR_CONNECTION_TIMED_OUT")) {
    return new BridgeError(504, "timeout", "The page took too long to respond. Try again.")
  }
  return new BridgeError(500, "action_failed", "The browser could not complete this action. Try again.")
}

export type BrowserBridge = {
  port: number
  token: string
  stop(): void
}

export function startBrowserBridge(getPanel: (id: string) => BrowserPanel | undefined): Promise<BrowserBridge> {
  const token = randomBytes(32).toString("hex")

  const server = createServer(async (req, res) => {
    try {
      const auth = req.headers.authorization
      if (auth !== `Bearer ${token}`) {
        sendJson(res, 401, { error: { code: "unauthorized", message: "Unauthorized." } })
        return
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const match = url.pathname.match(/^\/panels\/([^/]+)\/(.+)$/)
      if (!match) {
        sendJson(res, 404, { error: { code: "not_found", message: "Not found." } })
        return
      }
      const [, panelId, action] = match
      const panel = getPanel(panelId)
      if (!panel) {
        sendJson(res, 404, { error: { code: "panel_not_found", message: "The browser panel is not available." } })
        return
      }

      if (action === "navigate" && req.method === "POST") {
        const body = await readJson(req)
        await panel.navigate(requireUrl(body.url))
        snapshotRefs.delete(panelId)
        sendJson(res, 200, panel.state())
        return
      }
      if (action === "back" && req.method === "POST") {
        await panel.goBack()
        snapshotRefs.delete(panelId)
        sendJson(res, 200, panel.state())
        return
      }
      if (action === "forward" && req.method === "POST") {
        await panel.goForward()
        snapshotRefs.delete(panelId)
        sendJson(res, 200, panel.state())
        return
      }
      if (action === "reload" && req.method === "POST") {
        await panel.reload()
        snapshotRefs.delete(panelId)
        sendJson(res, 200, panel.state())
        return
      }
      if (action === "state" && req.method === "GET") {
        sendJson(res, 200, panel.state())
        return
      }
      if (action === "click" && req.method === "POST") {
        const body = await readJson(req)
        let x: number | undefined
        let y: number | undefined
        if (body.ref !== undefined) {
          const ref = requireString(body.ref, "ref")
          const refs = snapshotRefs.get(panelId)
          const backendNodeId = refs?.get(ref)
          if (backendNodeId === undefined) {
            throw new BridgeError(
              409,
              "stale_ref",
              "That element reference is no longer valid. Take a new snapshot and try again.",
            )
          }
          const box = await panel
            .sendCommand<{ model: { content: number[] } }>("DOM.getBoxModel", { backendNodeId })
            .catch(() => undefined)
          if (!box?.model?.content?.length) {
            throw new BridgeError(
              409,
              "element_not_visible",
              "That element is not visible on the page. Scroll it into view or take a new snapshot.",
            )
          }
          const quad = box.model.content
          x = (quad[0] + quad[4]) / 2
          y = (quad[1] + quad[5]) / 2
        } else {
          if (body.x === undefined || body.y === undefined) {
            throw new BridgeError(400, "invalid_target", "Provide either a ref or x and y to click.")
          }
          x = requireFinite(body.x, "x")
          y = requireFinite(body.y, "y")
        }
        await panel.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
        await panel.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
        sendJson(res, 200, { ok: true })
        return
      }
      if (action === "type" && req.method === "POST") {
        const body = await readJson(req)
        await panel.sendCommand("Input.insertText", { text: requireString(body.text, "text") })
        sendJson(res, 200, { ok: true })
        return
      }
      if (action === "key" && req.method === "POST") {
        const body = await readJson(req)
        const event = keyEvent(requireString(body.key, "key"))
        await panel.sendCommand("Input.dispatchKeyEvent", { ...event, type: "keyDown" })
        await panel.sendCommand("Input.dispatchKeyEvent", { ...event, type: "keyUp" })
        sendJson(res, 200, { ok: true })
        return
      }
      if (action === "scroll" && req.method === "POST") {
        const body = await readJson(req)
        const dx = requireFinite(body.deltaX, "deltaX", 0)
        const dy = requireFinite(body.deltaY, "deltaY", 0)
        await panel.sendCommand("Runtime.evaluate", { expression: `window.scrollBy(${dx}, ${dy})` })
        sendJson(res, 200, { ok: true })
        return
      }
      if (action === "screenshot" && req.method === "GET") {
        if (!panel.isVisible()) {
          throw new BridgeError(409, "panel_hidden", "The browser panel is closed. Ask the user to open it and try again.")
        }
        const image = await panel.view.webContents.capturePage()
        if (image.isEmpty()) {
          throw new BridgeError(409, "capture_empty", "The screenshot came back empty. Try again once the page finishes loading.")
        }
        const png = image.toPNG()
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length })
        res.end(png)
        return
      }
      if (action === "snapshot" && req.method === "GET") {
        const tree = await panel.sendCommand<{ nodes: Parameters<typeof flattenAXTree>[0] }>(
          "Accessibility.getFullAXTree",
        )
        const { outline, refs } = flattenAXTree(tree.nodes)
        snapshotRefs.set(panelId, refs)
        sendJson(res, 200, { outline })
        return
      }

      sendJson(res, 404, { error: { code: "unsupported_action", message: "That browser action is not supported." } })
    } catch (error) {
      const bridge = toBridgeError(error)
      writeLog("browser-bridge", `request failed: ${String(error)}`, { code: bridge.code }, "error")
      sendError(res, bridge)
    }
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("failed to determine browser bridge port"))
        return
      }
      resolve({
        port: address.port,
        token,
        stop: () => server.close(),
      })
    })
  })
}
