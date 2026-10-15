import { describe, expect, it } from "bun:test"
import { buildEditorUri } from "./editor-uri"

describe("buildEditorUri", () => {
  it("builds vscode URI by default", () => {
    expect(buildEditorUri("D:/dev/opencode/README.md")).toBe("vscode://file/D:/dev/opencode/README.md")
  })

  it("builds cursor URI when app is cursor", () => {
    expect(buildEditorUri("/home/user/project", "cursor")).toBe("cursor://file//home/user/project")
  })

  it("builds windsurf URI when app is windsurf", () => {
    expect(buildEditorUri("C:/code/app", "windsurf")).toBe("windsurf://file/C:/code/app")
  })

  it("handles paths with spaces safely", () => {
    expect(buildEditorUri("C:/My Projects/app.ts")).toBe("vscode://file/C:/My%20Projects/app.ts")
  })

  it("returns null for empty or invalid input", () => {
    expect(buildEditorUri("")).toBeNull()
    expect(buildEditorUri("   ")).toBeNull()
  })
})
