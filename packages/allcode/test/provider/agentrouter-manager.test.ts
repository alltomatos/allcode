import { describe, expect, test } from "bun:test"
import { parseWindowsNetstat, RELAY_VERSION } from "../../src/provider/agentrouter/manager"
import { RELAY_PY_SOURCE } from "../../src/provider/agentrouter/relay-source"

const output = [
  "",
  "Conexões ativas",
  "",
  "  Proto  Endereço local        Endereço externo       Estado           PID",
  "  TCP    127.0.0.1:7187        0.0.0.0:0              LISTENING       132",
  "  TCP    127.0.0.1:7188        0.0.0.0:0              LISTENING       133",
  "  TCP    127.0.0.1:7187        127.0.0.1:55000        ESTABLISHED     132",
].join("\r\n")

describe("agentrouter relay port recovery", () => {
  test("finds the PID listening on the requested port", () => {
    expect(parseWindowsNetstat(output, 7187)).toBe(132)
    expect(parseWindowsNetstat(output, 7188)).toBe(133)
  })

  test("ignores established connections and unknown ports", () => {
    expect(parseWindowsNetstat(output, 9999)).toBeUndefined()
    expect(parseWindowsNetstat("", 7187)).toBeUndefined()
  })

  test("embedded relay source matches the manager version", () => {
    expect(RELAY_PY_SOURCE).toContain(`RELAY_VERSION = ${RELAY_VERSION}`)
    expect(RELAY_PY_SOURCE).toContain(`{"ok": True, "version": RELAY_VERSION}`)
  })
})
