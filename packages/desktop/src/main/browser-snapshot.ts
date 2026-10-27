export type AXNode = {
  nodeId: string
  role?: { value?: string }
  name?: { value?: string }
  backendDOMNodeId?: number
  childIds?: string[]
  ignored?: boolean
}

/**
 * Flattens Chromium's accessibility tree into the `[ref_N] role "name"`
 * outline the model consumes. Roots are found in one pass over the child ids
 * instead of scanning every node for every candidate, which kept large pages
 * from stalling the Electron main process during `snapshot`.
 */
export function flattenAXTree(nodes: AXNode[]): { outline: string; refs: Map<string, number> } {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const childIds = new Set<string>()
  for (const node of nodes) {
    for (const childId of node.childIds ?? []) childIds.add(childId)
  }
  const roots = nodes.filter((n) => !childIds.has(n.nodeId))
  const lines: string[] = []
  const refs = new Map<string, number>()
  let counter = 0

  function visit(node: AXNode, depth: number) {
    if (node.ignored) {
      for (const childId of node.childIds ?? []) {
        const child = byId.get(childId)
        if (child) visit(child, depth)
      }
      return
    }
    const role = node.role?.value ?? "generic"
    const name = node.name?.value?.trim()
    if (role !== "generic" || name) {
      const ref = `ref_${++counter}`
      if (node.backendDOMNodeId !== undefined) refs.set(ref, node.backendDOMNodeId)
      const label = name ? `${role} "${name}"` : role
      lines.push(`${"  ".repeat(depth)}[${ref}] ${label}`)
    }
    for (const childId of node.childIds ?? []) {
      const child = byId.get(childId)
      if (child) visit(child, node.ignored ? depth : depth + 1)
    }
  }

  for (const root of roots) visit(root, 0)
  return { outline: lines.join("\n") || "(empty page)", refs }
}
