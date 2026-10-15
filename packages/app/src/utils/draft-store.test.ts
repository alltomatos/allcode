import { describe, expect, it } from "bun:test"
import { createDraftStore, type DraftStore } from "./draft-store"

describe("DraftStore with in-memory driver (TDD IndexedDB driver simulation)", () => {
  it("stores and retrieves draft documents and binary blobs", async () => {
    const memoryDocs = new Map<string, string>()
    const memoryBlobs = new Map<string, Blob>()

    const driver = {
      get: async (key: string) => memoryDocs.get(key) ?? null,
      set: async (key: string, value: string) => {
        memoryDocs.set(key, value)
      },
      remove: async (key: string) => {
        memoryDocs.delete(key)
      },
      putBlob: async (blob: Blob) => {
        const id = "blob-123"
        memoryBlobs.set(id, blob)
        return id
      },
      getBlob: async (id: string) => memoryBlobs.get(id) ?? null,
    }

    const store: DraftStore = createDraftStore(driver)

    await store.setItem("prompt:1", JSON.stringify({ message: "Hello world" }))
    const retrieved = await store.getItem("prompt:1")
    expect(retrieved).not.toBeNull()
    expect(JSON.parse(retrieved!)).toEqual({ message: "Hello world" })

    const testBlob = new Blob(["test-content"], { type: "text/plain" })
    const blobRef = await store.putBlob(testBlob)
    expect(blobRef.id).toBe("blob-123")
    expect(blobRef.url).toBeDefined()

    await store.removeItem("prompt:1")
    const deleted = await store.getItem("prompt:1")
    expect(deleted).toBeNull()
  })
})
