# Korovany

🎮 **Live app: <https://korovany.aimost.pl/>** · 📚 **Docs: <https://flopsstuff.github.io/korovany/>**

3D action game / browser SPA.

**Stack:** TypeScript · React 19 · Babylon.js · Redux Toolkit · Vite 6.
App deploys to **Cloudflare Pages**; docs deploy to **GitHub Pages** — both via **GitHub Actions**.

## Local development

```bash
git lfs install   # one time per machine (binary assets use Git LFS)
npm install
npm run dev       # dev server (http://localhost:5173)
npm test          # run the test suite (Vitest)
npm run build     # type-check + production build into ./dist
npm run preview   # serve the production build locally
npm run docs:dev  # preview the documentation site
```

## Project rules

These apply to every contributor — human or agent. Full version:
[`docs/guide/project-rules.md`](docs/guide/project-rules.md). For automated
contributors see [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).

1. **TypeScript `strict`, no `any`.** React function components only; 3D via
   Babylon.js; shared state via Redux Toolkit slices in `src/store/`.
2. **House style:** 2-space indent, single quotes, no semicolons; named exports.
3. **Branch per issue** (`flo-<issue>-<slug>`); keep `main` green and deployable;
   reference the issue in commits.
4. **Tests are mandatory** — every change ships with Vitest tests; `npm test`
   runs in CI and must pass.
5. **Docs are mandatory and never deferred** — update `docs/` in the same change;
   it auto-publishes to GitHub Pages.
6. **Binary assets via Git LFS** (`.gitattributes`): source binaries in
   `/assets`, bundled assets in `src/assets/`.
7. **Never commit secrets** — deploy creds live in GitHub Actions secrets.

## Project structure

```
src/app/        app shell & composition        src/store/    Redux Toolkit store + slices
src/engine/     Babylon Engine/Scene lifecycle src/scenes/   Babylon scenes & canvas wrapper
src/game/       engine-agnostic game logic     src/components/ reusable React UI
src/assets/     bundled assets                 src/hooks/    shared React hooks
assets/         source binaries (Git LFS)      src/types/    shared types
public/         static files served as-is      docs/         VitePress docs → GitHub Pages
```

See [`docs/guide/architecture.md`](docs/guide/architecture.md) for where new code belongs.

## Full-page game canvas

The game renders into a **full-window 3D canvas** — the document never scrolls
and there is no `max-width` container (`src/styles/global.css` resets
`html/body/#root` and hides overflow). React overlays sit above the canvas for
the HUD, main menu, and pause screen. The app boots into the main menu; **New
Game** enters play, **Continue** is present as a save-flow stub, and `ESC`
toggles `playing ⇄ paused`.

The Babylon `Engine`/`Scene` lifecycle lives in **[`src/engine/`](src/engine/index.ts)**,
not inline in a component. `createGameEngine(canvas)` owns engine + scene
creation, the high-DPI resize handler (`setHardwareScalingLevel(1 / devicePixelRatio)`
so the canvas stays crisp on retina), the render loop, and `dispose()`.
[`src/scenes/GameCanvas.tsx`](src/scenes/GameCanvas.tsx) is a thin React wrapper
that mounts the engine against a ref'd canvas and disposes it on unmount.

## 3D assets

Binary game assets (GLB models, textures, audio) are stored in **Git LFS** — run
`git lfs install` once before cloning or committing.

- **Generate** models with the `meshy-3d` skill: `python tools/meshy-3d/meshy.py …`
  (text/image → GLB via the Meshy API; needs `MESHY_API_KEY`). See
  [`tools/meshy-3d/SKILL.md`](tools/meshy-3d/SKILL.md).
- **Host** approved, web-ready GLBs in [`public/models/`](public/models/); Cloudflare
  Pages serves them from its CDN at `/models/<name>.glb`.
- **Load** them at runtime with `loadModel(scene, '/models/x.glb')`
  ([`src/scenes/modelLoader.ts`](src/scenes/modelLoader.ts)), which normalizes
  scale (longest side ≈ 2 units) and grounds the model on import.

Rationale and the import contract: [`docs/decisions/0001-asset-hosting.md`](docs/decisions/0001-asset-hosting.md)
and [`0002-glb-import-contract.md`](docs/decisions/0002-glb-import-contract.md).

## Deployment

Two independent targets, both on push to `main` (details:
[`docs/operations/deployment.md`](docs/operations/deployment.md)):

- **App → Cloudflare Pages** via `.github/workflows/deploy.yml`
  (`cloudflare/wrangler-action`). PRs build + test but don't deploy. The deploy
  step skips gracefully until the Cloudflare secrets exist, then activates
  automatically; `workflow_dispatch` allows manual runs.
- **Docs → GitHub Pages** via `.github/workflows/docs.yml` (VitePress).

### Required GitHub Actions secrets (app deploy)

| Secret                  | What it is                                                            |
| ----------------------- | -------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with the **Cloudflare Pages: Edit** permission  |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                                           |

Stored as **GitHub Actions secrets** (not project env vars) because the deploy
runs on GitHub's runners. Full credential playbook:
[`docs/operations/cloudflare-deploy.md`](docs/operations/cloudflare-deploy.md).
