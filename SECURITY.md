# Security Policy

## Reporting a vulnerability

The AllCode repository is private and maintained by Alltomatos. Please **do not** open public issues for security problems.

Report privately through either channel:

- GitHub Security Advisories: <https://github.com/alltomatos/allcode/security/advisories/new>
- Email: security@alltomatos.com (include reproduction steps, affected version/commit and impact)

You will get an acknowledgement within 72 hours. Please give us reasonable time to ship a fix before any disclosure.

## Scope

In scope:

- The desktop app (`packages/desktop`, `packages/app`), the CLI/server (`packages/allcode`, `packages/core`, `packages/llm`) and the tenant portal (`packages/panel`).
- Release and update infrastructure (npm packages, GitHub releases, update feeds).
- CI workflows and repository configuration.

Out of scope:

- The AI agent's lack of sandboxing. The permission system is a UX safeguard, not a security boundary; for real isolation run the agent in a container/VM.
- Self-hosted server mode left unauthenticated without `OPENCODE_SERVER_PASSWORD`.
- Vulnerabilities that require an attacker to already control the local machine or the operator account.

## Supported versions

Only the newest `prod` release (and the current `dev` prerelease channel) receive fixes. Older published versions are not patched; upgrade to the latest release.

## Handling secrets

Never include real credentials, tokens or customer data in a report. Redact them.
