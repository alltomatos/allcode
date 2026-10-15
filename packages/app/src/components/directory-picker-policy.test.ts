import { describe, expect, it } from "bun:test"
import { directoryPickerKind } from "./directory-picker-policy"
import { ServerConnection } from "@/context/server"

describe("directoryPickerKind policy", () => {
  it("returns native for desktop with builtin local server", () => {
    const builtinServer: ServerConnection.Any = {
      type: "sidecar",
      variant: "base",
      http: { url: "http://127.0.0.1:4096" },
    }
    expect(directoryPickerKind("desktop", builtinServer)).toBe("native")
  })

  it("returns server for web platform even with local or http server", () => {
    const httpServer: ServerConnection.Any = {
      type: "http",
      http: { url: "http://localhost:4096" },
      authToken: false,
    }
    expect(directoryPickerKind("web", httpServer)).toBe("server")
  })

  it("returns server when platform is desktop but server is remote http", () => {
    const remoteServer: ServerConnection.Any = {
      type: "http",
      http: { url: "https://remote.server.ai" },
      authToken: true,
    }
    expect(directoryPickerKind("desktop", remoteServer)).toBe("server")
  })
})
