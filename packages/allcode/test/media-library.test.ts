import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { findMedia, listMedia, MediaLibraryError, mediaKind, resolveMediaPath } from "../src/media-library"

const created: string[] = []

async function makeTree(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "media-library-"))
  created.push(root)
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
  }
  return root
}

afterEach(async () => {
  for (const dir of created.splice(0)) await fs.rm(dir, { recursive: true, force: true })
})

describe("media-library", () => {
  test("mediaKind reconhece extensões suportadas", () => {
    expect(mediaKind("foto.JPEG")).toBe("image")
    expect(mediaKind("video.mp4")).toBe("video")
    expect(mediaKind("audio.ogg")).toBe("audio")
    expect(mediaKind("catalogo.pdf")).toBe("document")
    expect(mediaKind("script.sh")).toBeUndefined()
  })

  test("lista raízes, subpastas e arquivos com caminho absoluto", async () => {
    const root = await makeTree({
      "Modelos-outubro/macacao-longo.jpeg": "a",
      "Modelos-outubro/conjunto-simples.jpeg": "b",
      "Modelos-outubro/nota.txt": "c",
      "leia-me.md": "d",
    })

    // Com uma �nica raiz, listar sem path mostra o conte�do dela.
    const rootsView = await listMedia({ roots: [root] })
    expect(rootsView.folder).toBe(root)
    expect(rootsView.folders.map((folder) => folder.name)).toEqual(["Modelos-outubro"])
    // 2 imagens + nota.txt (documento) contam como m�dia.\n    expect(rootsView.folders[0].files).toBe(3)

    const inside = await listMedia({ roots: [root], path: path.join(root, "Modelos-outubro") })
    expect(inside.folder).toBe(path.join(root, "Modelos-outubro"))
    expect(inside.files.map((file) => file.name)).toEqual([
      "conjunto-simples.jpeg",
      "macacao-longo.jpeg",
      "nota.txt",
    ])
    expect(inside.files.find((file) => file.name === "nota.txt")?.kind).toBe("document")
    for (const file of inside.files) expect(file.path.startsWith(root)).toBe(true)
  })

  test("aceita caminho relativo à primeira raiz", async () => {
    const root = await makeTree({ "sub/a.png": "x" })
    const listing = await listMedia({ roots: [root], path: "sub" })
    expect(listing.files[0].name).toBe("a.png")
  })

  test("bloqueia traversal, caminho absoluto externo e raiz inexistente", async () => {
    const root = await makeTree({ "ok/a.png": "x", "ok/b.png": "y" })
    const outside = await makeTree({ "segredo.png": "z" })

    await expect(resolveMediaPath([root], path.join(root, "..", "..", "etc"))).rejects.toBeInstanceOf(
      MediaLibraryError,
    )
    await expect(resolveMediaPath([root], path.join(outside, "segredo.png"))).rejects.toBeInstanceOf(
      MediaLibraryError,
    )
    // raiz inválida é descartada; sem raízes válidas => erro explícito
    await expect(listMedia({ roots: [path.join(root, "nao-existe")] })).rejects.toBeInstanceOf(MediaLibraryError)
  })

  test("find busca por nome sem diferenciar maiúsculas", async () => {
    const root = await makeTree({
      "Modelos-outubro/macacao-longo.jpeg": "a",
      "Modelos-outubro/conjunto-top-blusa.jpeg": "b",
      "outros/catalogo.pdf": "c",
    })

    const found = await findMedia({ roots: [root], query: "TOPO" })
    expect(found.results.map((item) => item.name)).toEqual([])

    const blusa = await findMedia({ roots: [root], query: "blusa" })
    expect(blusa.results.map((item) => item.name)).toEqual(["conjunto-top-blusa.jpeg"])

    const pdf = await findMedia({ roots: [root], query: "catalogo" })
    expect(pdf.results[0].kind).toBe("document")
  })

  test("find exige termo", async () => {
    const root = await makeTree({ "a.png": "x" })
    await expect(findMedia({ roots: [root], query: "   " })).rejects.toBeInstanceOf(MediaLibraryError)
  })
})
