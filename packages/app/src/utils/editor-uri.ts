export function buildEditorUri(path: string, app?: string): string | null {
  if (!path || typeof path !== "string") return null
  const sanitizedPath = path.trim().replace(/^["']|["']$/g, "")
  if (!sanitizedPath) return null

  const targetApp = (app ?? "vscode").toLowerCase()

  if (targetApp.includes("cursor")) {
    return `cursor://file/${encodeURI(sanitizedPath)}`
  }

  if (targetApp.includes("windsurf")) {
    return `windsurf://file/${encodeURI(sanitizedPath)}`
  }

  if (targetApp.includes("sublime")) {
    return `subl://open?url=file://${encodeURI(sanitizedPath)}`
  }

  // Default fallback is VS Code protocol
  return `vscode://file/${encodeURI(sanitizedPath)}`
}
