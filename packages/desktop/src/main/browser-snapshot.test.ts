import { describe, expect, it } from "bun:test"
import { flattenAXTree, type AXNode } from "./browser-snapshot"

describe("flattenAXTree", () => {
  it("finds roots, skips ignored wrappers and keeps refs stable", () => {
    const nodes: AXNode[] = [
      { nodeId: "root", role: { value: "RootWebArea" }, name: { value: "Page" }, childIds: ["ignored"] },
      { nodeId: "ignored", ignored: true, childIds: ["button"] },
      { nodeId: "button", role: { value: "button" }, name: { value: "Submit" }, backendDOMNodeId: 42 },
    ]

    const { outline, refs } = flattenAXTree(nodes)

    expect(outline).toBe(['[ref_1] RootWebArea "Page"', '  [ref_2] button "Submit"'].join("\n"))
    expect(refs.get("ref_2")).toBe(42)
  })

  it("keeps named generic nodes and drops unnamed ones", () => {
    const nodes: AXNode[] = [
      {
        nodeId: "root",
        role: { value: "RootWebArea" },
        childIds: ["generic-unnamed", "generic-named"],
      },
      { nodeId: "generic-unnamed", childIds: [] },
      { nodeId: "generic-named", name: { value: "Landmark" }, childIds: [] },
    ]

    const { outline } = flattenAXTree(nodes)

    expect(outline).toBe(['[ref_1] RootWebArea', '  [ref_2] generic "Landmark"'].join("\n"))
  })

  it("falls back to an explicit empty marker", () => {
    expect(flattenAXTree([]).outline).toBe("(empty page)")
  })
})
