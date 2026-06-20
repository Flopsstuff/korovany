# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Read this first

All project rules live in **[`AGENTS.md`](AGENTS.md)** and
**[`docs/guide/project-rules.md`](docs/guide/project-rules.md)**. Follow them.
This file only adds Claude-specific notes; it does not override AGENTS.md.

## Project snapshot

Korovany — 3D action game / browser SPA. Stack: TypeScript · React 19 ·
Babylon.js · Redux Toolkit · Vite 6. App → Cloudflare Pages
(<https://korovany.aimost.pl/>); docs → GitHub Pages.

## Non-negotiables (mirrors AGENTS.md)

- **Write tests** (Vitest) with every change; `npm test` must pass.
- **Update `docs/`** in the same change — never defer documentation.
- Keep `main` green: run `npm run lint && npm test && npm run build` before pushing.
- TypeScript `strict`, no `any`; React function components; state in `src/store/`.
- Binary assets via Git LFS (`.gitattributes`); never commit secrets.

## Practical notes for Claude

- **Babylon in tests:** jsdom has no WebGL, so stub the canvas in component
  tests (`vi.mock('../scenes/GameCanvas', …)`) — see `src/app/App.test.tsx`. To
  test engine code directly, inject Babylon's headless `NullEngine` (see
  `src/engine/index.test.ts`). Full guide:
  [`docs/guide/testing.md`](docs/guide/testing.md) (single source of truth).
- **Git auth:** the local PAT can't push/PR or read Actions secrets. Push over
  **SSH** (`git@github.com:Flopsstuff/korovany.git`). To trigger a deploy, push to
  `main` (an empty commit works); `workflow_dispatch` is not available to the PAT.
- **Folder map:** `docs/guide/architecture.md` says where new code belongs.
