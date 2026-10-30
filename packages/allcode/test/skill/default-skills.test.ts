import { describe, expect, it } from "bun:test"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import fs from "node:fs/promises"
import { DefaultSkills } from "../../src/skill/default-skills"
import { FILES, VERSION } from "../../src/skill/skills.gen"

async function tempHome() {
  return mkdtemp(path.join(os.tmpdir(), "allcode-skills-"))
}

describe("default skills", () => {
  it("seeds the bundled snapshot into an existing empty ~/.opencode/skills", async () => {
    const home = await tempHome()
    try {
      await fs.mkdir(path.join(home, ".opencode", "skills"), { recursive: true })

      const result = await DefaultSkills.ensureDefaultSkills(home)

      expect(result.skipped).toBe(false)
      expect(result.written).toBe(Object.keys(FILES).length)
      expect(await readFile(path.join(result.target, "engineering/architect/SKILL.md"), "utf8")).toContain("name: architect")
      expect(JSON.parse(await readFile(path.join(result.target, ".allcode-skills.json"), "utf8")).version).toBe(VERSION)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it("skips a second seed once the version marker matches", async () => {
    const home = await tempHome()
    try {
      await DefaultSkills.ensureDefaultSkills(home)

      const result = await DefaultSkills.ensureDefaultSkills(home)

      expect(result.skipped).toBe(true)
      expect(result.written).toBe(0)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it("never overwrites a skill the user edited", async () => {
    const home = await tempHome()
    try {
      const first = await DefaultSkills.ensureDefaultSkills(home)
      const skill = path.join(first.target, "engineering/architect/SKILL.md")
      await writeFile(skill, "user edited")

      await DefaultSkills.ensureDefaultSkills(home, { force: true })

      expect(await readFile(skill, "utf8")).toBe("user edited")
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it("fills missing files without touching existing ones", async () => {
    const home = await tempHome()
    try {
      const target = path.join(home, ".opencode", "skills")
      await fs.mkdir(path.join(target, "engineering", "architect"), { recursive: true })
      await writeFile(path.join(target, "engineering/architect/SKILL.md"), "custom")

      const result = await DefaultSkills.ensureDefaultSkills(home)

      expect(result.written).toBe(Object.keys(FILES).length - 1)
      expect(await readFile(path.join(target, "engineering/architect/SKILL.md"), "utf8")).toBe("custom")
      await stat(path.join(target, "engineering/tdd/SKILL.md"))
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
