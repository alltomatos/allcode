#!/usr/bin/env bun
import path from "node:path"

const pkgPath = path.resolve(import.meta.dir, "../package.json")
const raw = await Bun.file(pkgPath).text()
const pkg = JSON.parse(raw)

const current = (pkg.version ?? "0.1.0") as string
const parts = current.split(".").map((n) => Number.parseInt(n, 10))

if (parts.length !== 3 || parts.some(Number.isNaN)) {
  console.error(`Versão atual inválida em package.json: "${current}" (esperado formato x.y.z)`)
  process.exit(1)
}

const arg = (process.argv[2] ?? "patch").toLowerCase()

let next = ""
if (arg === "patch") {
  next = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
} else if (arg === "minor") {
  next = `${parts[0]}.${parts[1] + 1}.0`
} else if (arg === "major") {
  next = `${parts[0] + 1}.0.0`
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg
} else {
  console.error(`Uso: bun run bump [patch | minor | major | <versao-explicita>]`)
  console.error(`Exemplo: bun run bump patch   (de ${current} para ${parts[0]}.${parts[1]}.${parts[2] + 1})`)
  process.exit(1)
}

pkg.version = next
await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

console.log(`\n📦 Versão do portal atualizada com sucesso:`)
console.log(`   v${current} -> v${next}\n`)
