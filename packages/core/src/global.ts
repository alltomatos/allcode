import path from "path"
import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import os from "os"
import { Context, Effect, Layer } from "effect"
import { Flock } from "./util/flock"
import { Flag } from "./flag/flag"
import { makeGlobalNode } from "./effect/app-node"

import { Branding } from "./platform/branding"

const app = Branding.appName

// Isolamento por profile (dev/beta/...): a build de desenvolvimento nunca deve
// escrever no mesmo config/data/state do app instalado. Sem isso, as duas
// builds leem o MESMO arquivo de config e uma reescreve por cima da outra —
// foi assim que um schema mais novo de agente derrubou a config do app
// instalado (ConfigInvalidError em todos os consumidores de config).
//
// `OPENCODE_PROFILE=dev` => ~/.config/allcode-dev, ~/.local/share/allcode-dev
// e o banco `allcode-dev.db` (o nome do DB já vem do canal de instalação).
function profileSuffix(): string {
  const profile = (process.env["OPENCODE_PROFILE"] ?? "").trim().toLowerCase()
  if (!profile || profile === "prod" || profile === "production" || profile === "latest") return ""
  return `-${profile.replace(/[^a-z0-9._-]/g, "-")}`
}

/** Profile ativo ("dev", "beta", ...) ou "" no app instalado. */
export function profileName(): string {
  return profileSuffix().replace(/^-/, "")
}

const suffix = profileSuffix()
const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
// Só o diretório de CONFIG é isolado por profile. `data` continua compartilhado
// de propósito: é onde vive o auth.json (tokens/chaves dos providers) — mover
// isso para um profile deixaria o dev "esquecido" de todos os providers.
// O banco e a sessão do zapo são isolados por nome de arquivo, não por diretório.
const config = path.join(xdgConfig!, app + suffix)
const state = path.join(xdgState!, app)
const tmp = path.join(os.tmpdir(), app)

const paths = {
  get home() {
    return process.env.OPENCODE_TEST_HOME ?? os.homedir()
  },
  data,
  bin: path.join(cache, "bin"),
  log: path.join(data, "log"),
  repos: path.join(data, "repos"),
  cache,
  config,
  state,
  tmp,
}

export const Path = paths

Flock.setGlobal({ state })

await Promise.all([
  fs.mkdir(Path.data, { recursive: true }),
  fs.mkdir(Path.config, { recursive: true }),
  fs.mkdir(Path.state, { recursive: true }),
  fs.mkdir(Path.tmp, { recursive: true }),
  fs.mkdir(Path.log, { recursive: true }),
  fs.mkdir(Path.bin, { recursive: true }),
  fs.mkdir(Path.repos, { recursive: true }),
])

export class Service extends Context.Service<Service, Interface>()("@opencode/Global") {}

export interface Interface {
  readonly home: string
  readonly data: string
  readonly cache: string
  readonly config: string
  readonly state: string
  readonly tmp: string
  readonly bin: string
  readonly log: string
  readonly repos: string
}

export function make(input: Partial<Interface> = {}): Interface {
  return {
    // A live getter, not a value captured once: `Global.Service` is built a
    // single time and shared for the life of the process (see
    // `makeGlobalNode` below), but tests toggle `OPENCODE_TEST_HOME`
    // per-test/per-file to isolate `~/.claude`, `~/.agents`, etc. scanning
    // (see packages/opencode/src/skill/index.ts's `discoverSkills`, and
    // test/skill/skill.test.ts's `withHome` helper). Baking `Path.home` into
    // a plain string here would freeze it to whatever it resolved to at the
    // very first `Global.Service` construction in the whole test run,
    // silently making every later `withHome()` override a no-op and letting
    // skill discovery read the real machine home directory instead — which
    // is how a leftover/real skill file cross-contaminates otherwise
    // properly-isolated tests. See 2026-09-08 CI investigation into
    // `unit (linux)`'s `skill > ...` failures.
    get home() {
      return Path.home
    },
    data: Path.data,
    cache: Path.cache,
    config: Flag.OPENCODE_CONFIG_DIR ?? Path.config,
    state: Path.state,
    tmp: Path.tmp,
    bin: Path.bin,
    log: Path.log,
    repos: Path.repos,
    ...input,
  }
}

const layer = Layer.effect(
  Service,
  Effect.sync(() => Service.of(make())),
)

export const node = makeGlobalNode({ service: Service, layer: layer, deps: [] })

export const layerWith = (input: Partial<Interface>) =>
  Layer.effect(
    Service,
    Effect.sync(() => Service.of(make(input))),
  )

export * as Global from "./global"
