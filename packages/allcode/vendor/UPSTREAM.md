# Vendored skills

These skills are a snapshot of [alltomatos/skills](https://github.com/alltomatos/skills),
vendored into this repository so every AllCode build ships them offline instead
of downloading a moving branch at runtime.

- Upstream repository: `alltomatos/skills`
- Pinned commit: `d5ab30dff9464e138ff549f33801cd38e08618b7`
- Upstream license: MIT (see `LICENSE` in this directory)

The contents of `skills/` are copied verbatim from the upstream `skills/`
directory at that commit. Do not edit them by hand; update the pinned commit in
`packages/allcode/script/skills-upstream.ts` and run:

```sh
bun run script/sync-skills.ts
```

That refreshes `skills/`, the upstream metadata, and the generated manifest at
`src/skill/skills.gen.ts`.
