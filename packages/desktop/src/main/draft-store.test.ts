import { expect, test } from "bun:test"

// Bun does not expose node:sqlite yet; Electron's Node runtime does. Keep the
// coverage available on runtimes with node:sqlite without erroring the suite.
const sqlite = await import("node:sqlite").then(
  () => true,
  () => false,
)

if (!sqlite) {
  test.skip("flushes the latest buffered draft and stores blobs (requires node:sqlite)", () => {})
} else {
  const { createDesktopDraftStore } = await import("./draft-store")

  test("flushes the latest buffered draft and stores blobs", () => {
    const store = createDesktopDraftStore(":memory:")
    store.set("prompt", "first")
    store.set("prompt", "latest")
    expect(store.get("prompt")).toBe("latest")
    store.flush()
    expect(store.get("prompt")).toBe("latest")

    const bytes = new TextEncoder().encode("image")
    const id = store.putBlob(bytes)
    expect(store.getBlob(id)).toEqual(bytes)
    store.close()
  })
}
