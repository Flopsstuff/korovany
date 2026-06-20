# AGENTS.md

Guidance for automated contributors (and humans) working in this repo. This is
the canonical, tool-agnostic rule set; `CLAUDE.md` defers to it.

## What this project is

Korovany — a 3D action game / browser SPA.
**Stack:** TypeScript · React 19 · Babylon.js · Redux Toolkit · Vite 6.
Live app: <https://korovany.aimost.pl/> · Docs: <https://fl0p.github.io/korovany/>

## Golden rules

1. **Tests are mandatory.** Every change ships with Vitest tests. `npm test`
   must pass before you push. Co-locate `*.test.ts(x)` next to the code.
2. **Docs are mandatory and not deferred.** Update `docs/` in the *same* change
   as the code. Docs publish to GitHub Pages on push to `main`.
3. **`main` stays green and deployable.** Never push code that fails CI.
4. **TypeScript `strict`, no `any`.** React function components only. 3D via
   Babylon; shared state via Redux Toolkit slices in `src/store/`.
5. **Binary assets via Git LFS** (see `.gitattributes`). Run `git lfs install`
   once. Source binaries → `/assets`; bundled assets → `src/assets/`.
6. **Never commit secrets.** Deploy creds live in GitHub Actions secrets.

## Workflow

- Branch per issue: `flo-<issue>-<slug>`. Reference the issue in commits (`FLO-253`).
- Before pushing, run locally: `npm run lint && npm test && npm run build`.
- Keep `AGENTS.md`, `CLAUDE.md`, and `docs/guide/project-rules.md` in sync.

## Commands

| Command           | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Dev server                               |
| `npm test`        | Run tests once (CI uses this)            |
| `npm run lint`    | Type-check (`tsc -b --noEmit`)           |
| `npm run build`   | Type-check + production build → `dist/`   |
| `npm run docs:dev`| Preview the docs site                    |

## Where code goes

See [`docs/guide/architecture.md`](docs/guide/architecture.md) for the full
folder map. Short version: scenes → `src/scenes/`, UI → `src/components/`,
pure game logic → `src/game/`, state → `src/store/`.

## Repo gotcha: git auth

The local GitHub PAT cannot push or open PRs on this repo (missing
Contents/PR write) and cannot read Actions secrets. Push over **SSH**
(`git@github.com:Fl0p/korovany.git`); PRs must be opened by a human or a token
with PR write. Deploys are triggered by pushing to `main`.
