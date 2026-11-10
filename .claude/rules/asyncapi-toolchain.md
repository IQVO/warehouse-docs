---
paths:
  - "tools/asyncapi-gen/**"
  - "scripts/gen-async-docs.mjs"
  - "package.json"
  - "package-lock.json"
  - ".github/workflows/**"
  - "static/asyncapi/**"
---

# The isolated AsyncAPI toolchain

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

`postinstall` runs `npm --prefix tools/asyncapi-gen install` automatically
on `npm install`/`npm ci` at the repo root — but CI (`.github/workflows/docs.yml`)
also runs `npm --prefix tools/asyncapi-gen ci` explicitly as a separate
step, because a plain `npm ci` at the repo root does NOT recurse into it.

## Why the AsyncAPI toolchain is isolated (`tools/asyncapi-gen/`)

`docusaurus-plugin-openapi-docs` needs React 19 (current Docusaurus).
`@asyncapi/html-template` (the official AsyncAPI Generator template) pulls
in its own React 18 renderer as a transitive dependency. Installing both in
ONE `node_modules` tree causes an intermittent, hard-to-diagnose failure
during static generation ("Objects are not valid as a React child"). This
is a real npm hoisting/dedup collision, not a bug in either package.

Fix in place: `tools/asyncapi-gen/package.json` contains ONLY
`@asyncapi/cli` + `@asyncapi/html-template`, installed into its own
`node_modules`. `scripts/gen-async-docs.mjs` invokes its installed binary
via `execFileSync(..., {cwd: 'tools/asyncapi-gen'})` so the generator
process resolves React from ITS OWN tree. Never `npx @asyncapi/cli` — it
re-resolves and downloads the whole dependency tree fresh every invocation
(10+ minutes cold vs under a minute once installed).
