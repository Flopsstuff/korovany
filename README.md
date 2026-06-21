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
Game** enters play, **Continue** resumes the latest save (see
[Saving progress](#saving-progress)), `ESC` toggles `playing ⇄ paused`, and `M`
(or the HUD **Travel** button) opens the world map (see
[World map & fast-travel](#world-map--fast-travel)).

The Babylon `Engine`/`Scene` lifecycle lives in **[`src/engine/`](src/engine/index.ts)**,
not inline in a component. `createGameEngine(canvas)` owns engine + scene
creation, the high-DPI resize handler (`setHardwareScalingLevel(1 / devicePixelRatio)`
so the canvas stays crisp on retina), the render loop, and `dispose()`.
[`src/scenes/GameCanvas.tsx`](src/scenes/GameCanvas.tsx) is a thin React wrapper
that mounts the engine against a ref'd canvas and disposes it on unmount.

## Objective & win/lose loop

New Game drops the player into the forest with a HUD **objective** — *Raid 3
caravans* — and a running **Score** (kills + loot). Raiding all three caravans
shows an explicit **win** screen; dying shows a **lose** screen. Both offer
**Restart** (a fresh run) and **Main Menu**. The win/lose decision is a pure,
unit-tested state machine (`src/game/objective/objectiveMachine.ts`) that drives
the `app` phase into `won`/`lost`; per-run progress and score live in
`gameSlice`. Full details: [`docs/guide/objective-loop.md`](docs/guide/objective-loop.md).

## World map & fast-travel

The world has **four zones** (Human lands, Empire, Forest, Mountains). During
play, press `M` or click the HUD **Travel** button to open the world-map overlay
and **fast-travel** between the zones that have a playable scene. Selecting a
zone shows a Travel/Cancel confirm; on confirm the player is teleported to that
zone's spawn and its scene is mounted.

E3.1 ships **Forest** (the vertical slice) and a **Human-lands** stub as
available; **Empire** and **Mountains** are listed but locked until their scenes
exist. The zone registry lives in [`src/game/world/`](src/game/world/) and the
current zone id is persisted in saves. Full details:
[`docs/guide/world-map.md`](docs/guide/world-map.md) (lore/layout targets in
[`docs/guide/world-specs.md`](docs/guide/world-specs.md)).

## Inventory & loot

Raiding caravans (the "грабить корованы" loop) drops loot the player collects
into a carried **inventory**, shown in a HUD panel below the health bar while
playing (E3.4).

- **Model:** a pure, serialisable `itemId → count` map plus one equipped slot
  lives in [`src/game/economy/`](src/game/economy/); the Redux integration is
  [`src/store/inventorySlice.ts`](src/store/inventorySlice.ts). Item display
  names/flags come from the static catalog in
  [`src/game/economy/items.ts`](src/game/economy/items.ts) — the save stores only
  ids + counts, so adding a lootable good is a catalog entry with no schema bump.
- **Pick up:** a defeated caravan (E3.3) dispatches `pickUpLoot({ itemId, count })`;
  the HUD panel reflects the carried stacks, marks the equipped item, and shows an
  explicit empty state before any loot is collected.
- **Persistence:** the inventory is part of the save snapshot (see
  [Saving progress](#saving-progress)) and is restored on **Continue** / cleared on
  **New Game**.'

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
  scale (longest side ≈ 2 units) and grounds the model on import. The returned
  `root` is a clean placement node; scene code may set `root.position` without
  erasing the internal grounding offset.

Rationale and the import contract: [`docs/decisions/0001-asset-hosting.md`](docs/decisions/0001-asset-hosting.md)
and [`0002-glb-import-contract.md`](docs/decisions/0002-glb-import-contract.md).

## Saving progress

Player progress survives a browser reload. A small **versioned** snapshot — the
player's transform (position + yaw), health (`current` + `max`), zone id,
carried [inventory](#inventory--loot), and character progression — is persisted to the browser's
**IndexedDB** (`korovany-save` database, one autosave slot).

- **Autosave on pause:** entering the paused state writes the snapshot.
- **Continue:** the main menu's Continue button loads the latest slot and spawns
  the player at the saved pose/health; it is disabled with an empty-state hint
  when no save exists.
- **Retention:** saves persist on the device until overwritten by the next
  autosave or cleared (`clearSave()`, or clearing the site's browser data).
  Nothing is uploaded; saves are local to the browser.

The schema is **forever** — fields are never renamed; format changes bump
`SAVE_VERSION` and add a migration. `SAVE_VERSION` is currently **3** (v2 added
`inventory`; v3 added `progression`; older saves migrate forward with empty /
baseline values). Full details, slot
model, and the test approach (`fake-indexeddb`):
[`docs/guide/save-system.md`](docs/guide/save-system.md).

## Audio

The game gives **audible feedback for every action** — enemy hit, enemy kill,
player taking damage, swing, win, and lose — through a tiny raw Web Audio bus
([`src/game/audio/`](src/game/audio/)). SFX are **synthesized procedurally** (no
sample files, no Git LFS payload, no third-party licensing); the bus subscribes
to the existing combat event bridge rather than scattering playback calls.

- **Mute + volume** live in the **pause menu** (press `Escape`). Both persist
  across reloads in `localStorage` under the **`korovany-audio`** key
  (`{ muted, volume }`; default `{ false, 0.7 }`).
- The `AudioContext` is created/resumed only on the **first user gesture**
  (click or keypress) to respect browser autoplay policy — no autoplay warnings.

Full design, the event map, and how to add a sound:
[`docs/guide/audio.md`](docs/guide/audio.md).

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
