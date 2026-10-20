# AllCode

<p align="center">
  <strong>Autonomous platform for building business solutions and corporate automations with AI agents</strong>
</p>

<p align="center">
  <a href="https://github.com/alltomatos/allcode/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/alltomatos/allcode?style=flat-square" /></a>
  <a href="https://github.com/alltomatos/allcode/actions"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/alltomatos/allcode/release-prod.yml?style=flat-square&branch=prod" /></a>
  <a href="https://chat.whatsapp.com/DOLzfQ4aPZ12R7ZRbLabNh"><img alt="WhatsApp community" src="https://img.shields.io/badge/Community-WhatsApp-25D366?style=flat-square&logo=whatsapp" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

---

AllCode is an open source platform for **business solution development, complex integrations, and intelligent corporate automations**. Instead of focusing only on editing code, it works as an orchestration hub: scripts, ETL pipelines, queue workers, scheduled routines, specialized chat agents, and system integrations in one place.

AllCode is a fork of [OpenCode](https://github.com/anomalyco/opencode), maintained by [Alltomatos](https://github.com/alltomatos), extended with a corporate desktop app, side-by-side isolation, agent builder, schedules, messaging integrations, and memory.

## Highlights

- **End-to-end automations** — scripts, ETL pipelines, queue orchestrators, and scheduled corporate routines.
- **AgentUI** — visual builder for specialized agents (system prompt, model, skills) with a built-in sandbox chat.
- **System integration** — MCP servers, REST APIs, webhooks, Telegram/WhatsApp bots, and browser automation.
- **Desktop app** — Windows, macOS, and Linux, with full parity with the web client.
- **Side-by-side isolation** — runs alongside other tools without conflicts:
  - dedicated port `1953` (upstream uses `4096`);
  - dedicated SQLite database (`allcode.db`);
  - per-project `.allcode/` directory with `allcode.json` / `allcode.jsonc`;
  - `allcode://` protocol and `ai.allcode.desktop` app id.
- **Non-destructive migration** — `allcode import --opencode` reads the legacy database and copies sessions, messages, and tools with idempotency.
- **Persistent memory** — global (`~/.local/share/allcode/memory/global`) and per-project (`~/.local/share/allcode/memory/projects/<project>`) rules and decisions, queried on demand via `memory_search` and written via `memory_save`.

## Desktop app

The desktop app is the primary experience:

- **Code** — solution engineering with file tree, context monitor, and version control.
- **AgentUI** — create, edit, and test autonomous agents in an isolated chat.
- **Schedules** — cron-like routines, triggers, and desktop notifications.
- **Metrics** — token usage, cost per provider/model, and media attachments.
- **Execution panels** — multiplexed PTY terminal, embedded Chromium browser, diff review (split/inline with line comments), and explicit permission gates for critical commands.
- **Settings v2** — appearance, language, autostart, tray/background, shortcuts, database diagnostics, local/remote servers (SSH, WSL, QR pairing), provider catalog, failover combos, skills, MCP servers, messaging, and external agents.

## Web and headless servers

The web UI matches the desktop experience. To keep automations running 24/7 on a server or VPS:

```bash
export ALLCODE_SERVER_PASSWORD="a-strong-password"

allcode web --hostname 0.0.0.0 --port 1953    # full web UI
# or
allcode serve --hostname 0.0.0.0 --port 1953  # API only (desktop/TUI clients)
```

Then open `http://server-ip:1953` or add it as a remote server in the desktop app.

## Installation

### Desktop

Download the installer from the [releases page](https://github.com/alltomatos/allcode/releases/latest):

| Platform | Artifact |
| --- | --- |
| Windows | `allcode-desktop-win-x64.exe` (NSIS) |
| macOS | `allcode-desktop-mac-universal.dmg` / `.zip` (Apple Silicon + Intel) |
| Linux (Debian/Ubuntu) | `allcode-desktop-linux-x64.deb` |
| Linux (Fedora/RHEL) | `allcode-desktop-linux-x64.rpm` |
| Linux (universal) | `allcode-desktop-linux-x64.AppImage` |

macOS builds are not signed or notarized by this fork (no Apple Developer account is configured). On first launch, right-click the app → **Open** to bypass Gatekeeper.

### CLI and server via npm

```bash
npm install -g @alltomatosbr/allcode@latest  # latest stable (published from prod)
npm install -g @alltomatosbr/allcode@dev     # rolling dev (published from dev)
```

### Terminal UI

```bash
allcode
```

## Development

```bash
git clone -b dev https://github.com/alltomatos/allcode.git
cd allcode
bun install

bun dev              # run the TUI in development
bun dev:desktop      # run the Electron desktop app in development
bun turbo typecheck  # typecheck the monorepo
```

## Releases

- [`release-prod.yml`](./.github/workflows/release-prod.yml) runs on every push to `prod`: it publishes the CLI to npm (`@alltomatosbr/allcode@latest`), builds Windows/macOS/Linux installers in parallel, publishes a single GitHub Release, and commits the next patch version back to `prod`.
- [`release-npm-dev.yml`](./.github/workflows/release-npm-dev.yml) publishes `@alltomatosbr/allcode@dev` on every push to `dev`.

To rebuild an existing version manually (for example, retrying a platform that failed):

```bash
gh workflow run release-prod.yml -f version=<version>
```

## Branches

- **`prod`** — production. Only this branch produces published releases and feeds the auto-updater.
- **`dev`** — development. All new work lands here first.

## Credits and license

AllCode is built on the work of the **[OpenCode](https://github.com/anomalyco/opencode)** team (`anomalyco`): the coding agent, TUI, protocol, and SDK come from the original project, while this fork adds the corporate desktop layer, branding, and integrations.

- Original project: [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
- Documentation: [opencode.ai/docs](https://opencode.ai/docs)
- License: see [LICENSE](./LICENSE)

If you are not specifically looking for this fork, use the [original project](https://github.com/anomalyco/opencode).

> Other `README.<lang>.md` files come from the upstream project and may still describe OpenCode instead of AllCode. The English and Portuguese (BR) files are the source of truth.
