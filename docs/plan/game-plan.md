# Korovany — Game Development Plan

> Canonical design source: [Flopsstuff/korovany#2](https://github.com/Flopsstuff/korovany/issues/2)
> (the original "корованы" brief from Kirill). Coordination issue: **FLO-273**.
> This document is the **living plan**. It is updated as the tree grows — every
> new epic/task references the phase it belongs to. Plan revisions are gated for
> board approval before implementation subtasks are created.

## 0. What we are building (from the canonical brief)

A browser, **serverless**, single-player (+ NPC) **3D action-RPG**. The player can
play as one of three factions and roam a world of **four zones**:

| # | Zone | Owner | Notes |
|---|------|-------|-------|
| 1 | Human lands | Neutral | trade, towns |
| 2 | Empire | Emperor | the **palace** to attack/defend |
| 3 | Forest | **Forest Elves** | dense forest, wooden huts |
| 4 | Mountains | **The Villain** | an old fort |

Signature features from the brief, mapped to where they live in this plan:

- **Three playable factions** with asymmetric goals (Elves raid; Palace Guard
  obeys a commander & defends; Villain commands their own troops). → Phase 4
- **Rob the caravans** ("грабить корованы") — the signature loot loop. → Phase 3
- **Dense forest with LOD**: distant trees as billboards/impostors that resolve
  into full 3D as you approach. → Phase 5
- **Daggerfall-like RPG layer**: shops, buying, character progression. → Phase 4
- **Combat**: melee, jumping, 3D enemies, **3D corpses**. → Phase 2
- **Injury / dismemberment**: lose a hand → bleed out if untreated; lose an eye →
  half-screen blackout (or prosthetic); lose a leg → die / crawl / wheelchair /
  prosthetic; healing. → Phase 2 (model) + Phase 6 (full prosthetic economy)
- **Browser saves**. → Phase 1

> "Я джва года хочу такую игру." We respect the ambition by shipping a **playable
> vertical slice early** and growing the tree toward the full vision, rather than
> attempting the whole myth at once.

## 1. Engineering principles for this plan

- **Vertical slice first.** Phase 1 proves the entire stack (full-page render,
  controller, streaming, save/load) with one faction in one zone. Every later
  phase widens, it does not re-architect.
- **Serverless, browser-only.** No backend, ever. Saves use **IndexedDB**;
  assets stream from static hosting (Cloudflare Pages + Git LFS, per
  [ADR-0001](../decisions/0001-asset-hosting.md)).
- **Dynamic asset loading is a first-class system**, not an afterthought — the
  brief demands streaming forests and zones. Built in Phase 1, exploited in 5.
- **Small, oneshot tasks.** Each ticket is sized for ~one commit / one MR with a
  testable acceptance criterion. Big features become epics (child issues) whose
  children are the oneshots.
- **Tests + docs in the same change** (AGENTS.md golden rules). No exceptions.
- **Boring tech a maintainer can debug at 2am.** Babylon's built-in systems
  (camera, physics, GLB import, instancing/LOD) before any bespoke engine code.
- **Assets are generated per concrete character ticket only** — never
  speculatively (board directive FLO-270). Low-poly visual language v1.2
  (≤3000 tris/object) is binding; see the visual-language doc.

## 2. System architecture (target)

```
src/
├── app/            App shell: routes menu ↔ game, mounts HUD over canvas
├── scenes/         Babylon worlds — one GameScene that hosts the active zone
├── game/           Engine-agnostic systems & rules (the bulk of gameplay):
│   ├── loop/         fixed-step update loop, system scheduler
│   ├── input/        keyboard/mouse/pointer-lock → intent
│   ├── controller/   character movement, jump, collision
│   ├── camera/       third-person follow rig
│   ├── streaming/    asset registry, lazy GLB loading, LOD/impostors
│   ├── combat/       melee, hit detection, damage
│   ├── health/       hit points, injuries, dismemberment, healing
│   ├── ai/           NPC behaviour (patrol/chase/attack/flee)
│   ├── world/        zones, terrain, spawn tables, caravans
│   ├── faction/      faction definitions, objectives, command
│   ├── economy/      currency, shops, inventory
│   └── save/         IndexedDB serialize/restore, save slots
├── components/     React HUD (health, minimap, inventory, dialogs)
├── store/          Redux slices bridging game state ↔ HUD
└── types/          shared domain types
```

Data flow stays as today: Babylon owns the render loop and writes salient state
into Redux; React HUD reads via typed selectors. Pure game logic in `src/game/`
has **no** React/Babylon imports where avoidable, so it is unit-testable in jsdom.

## 3. The plan tree (phases → epics → sample tasks)

Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
Each epic becomes a **child issue of FLO-273**; each task a child of its epic.

### Phase 0 — Foundation cleanup (unblocks everything) `[x]`

Epic: **[FLO-277](/FLO/issues/FLO-277)** — board plan approved 2026-06-20.

> **Done & merged to `main` 2026-06-20.** The full-page canvas, fixed-step loop,
> and input system are live on korovany.aimost.pl. Concurrent runs produced
> duplicate tickets (FLO-281/282/284/285) which were reconciled/cancelled; the
> canonical merged PRs are below.

- **E0.1 Full-page canvas & app shell** `[x]` — FLO-280 (PR #4), FLO-283 (PR #7)
  - [x] Make the Babylon canvas fill the viewport (replace fixed 320px); handle resize/DPR.
  - [ ] App state machine: `menu → playing → paused`; ESC toggles pause. *(carried into E1.0)*
  - [ ] Main menu shell (New Game / Continue / Settings) as a React overlay. *(carried into E1.0)*
- **E0.2 Game loop & system scheduler** `[x]` — FLO-278 (PR #5)
  - [x] Fixed-step update loop in `src/game/loop/` decoupled from render FPS; unit-tested.
  - [x] System registration API (systems get `update(dt, world)`).
- **E0.3 Input system** `[x]` — FLO-279 (PR #3)
  - [x] Keyboard/mouse intent mapping; pointer-lock for mouselook; rebindable map (data-driven).

### Phase 1 — Vertical slice: "An elf in the forest" `[~]`

Goal: a deployed build where you start a new game, spawn as an elf in a small
forest, walk/run/jump with a third-person camera over solid ground, and your
position+health survive a reload (browser save). Proves the whole stack.

Epic: **[FLO-291](/FLO/issues/FLO-291)** — decomposed into canonical oneshot
tickets 2026-06-20 (one MR each). **Check these before cutting any new Phase-1
child** (Phase 0 was built 3× by concurrent runs). Blocker DAG:
E1.2→E1.3, E1.1→E1.4, and {E1.0,E1.1,E1.3,E1.4}→E1.5.

- **E1.0 App state machine & menu shell** `[x]` — FLO-292 (Aldric) ✅ merged 82788cd *(carried from E0.1)*
  - [x] `menu → playing → paused` state machine; ESC toggles pause.
  - [x] Main menu shell (New Game / Continue / Settings) as a React overlay over the canvas.
- **E1.1 Third-person character controller** `[ ]` — FLO-293 (Wayland)
  - [ ] Capsule controller: WASD move, sprint, gravity, ground collision.
  - [ ] Jump with coyote-time; cannot double-jump.
  - [ ] Third-person follow camera with collision-aware boom.
- **E1.2 Asset streaming manager** `[ ]` — FLO-294 (Soren)
  - [ ] Asset registry (id → URL + metadata); `streaming/` loads GLB on demand, caches, disposes.
  - [ ] Loading state surfaced to HUD; graceful fallback placeholder while loading.
- **E1.3 First zone (forest stub)** `[ ]` — FLO-295 (Lyra, blocked by FLO-294; **needs assets FLO-299**)
  - [ ] Ground/terrain mesh for a small forest clearing with collision.
  - [ ] Scatter a handful of streamed tree + hut GLBs (static, no LOD yet).
  - *Assets:* the tree + hut GLBs come from **FLO-299** (Pygmalion); they did not
    exist in the repo when Phase 1 was decomposed. Land FLO-299 before E1.3 starts.
- **E1.4 Save/load (IndexedDB)** `[ ]` — FLO-296 (Wayland, blocked by FLO-293)
  - [ ] Serialize player transform + health + zone id to IndexedDB; restore on Continue.
  - [ ] Save-slot UI (≥1 slot); autosave on pause.
- **E1.5 Deploy the slice** `[ ]` — FLO-297 (Wayland, blocked by FLO-292/293/295/296)
  - [ ] Wire GameScene into the app; ship to korovany.aimost.pl; smoke in a real browser.

### Phase 2 — Combat, health & injuries `[ ]`

- **E2.1 Health & damage model** `[ ]` — HP, damage events, death state, respawn/load.
- **E2.2 Melee combat** `[ ]` — attack animation window, hitbox sweep, damage to targets.
- **E2.3 Enemy NPC (first archetype)** `[ ]` — patrol → detect → chase → attack → die; one soldier model.
- **E2.4 3D corpses** `[ ]` — on death, leave a ragdoll/static corpse mesh that persists & can be looted.
- **E2.5 Injury & dismemberment model** `[ ]` — data model for limb/eye/leg states.
  - [ ] Lose-a-hand → bleed timer → death if untreated; healing item stops it.
  - [ ] Lose-an-eye → half-screen vignette; prosthetic/eyepatch removes it.
  - [ ] Lose-a-leg → crawl/reduced-speed locomotion state.

### Phase 3 — World, caravans & loot loop `[ ]`

- **E3.1 World map & 4 zones** `[ ]` — zone definitions, fast-travel/world map UI, per-zone streaming.
- **E3.2 Zone streaming** `[ ]` — load/unload zone content as the player crosses borders; budget memory.
- **E3.3 Caravans ("грабить корованы")** `[ ]` — wandering caravan entities, ambush, loot tables, reward.
- **E3.4 Inventory & loot** `[ ]` — pick up, carry, equip; HUD inventory panel.

### Phase 4 — Factions & economy (the RPG layer) `[ ]`

- **E4.1 Faction system** `[ ]` — faction data, reputation, friend/foe targeting.
- **E4.2 Faction selection & asymmetric goals** `[ ]`
  - [ ] Elf campaign: raid empire/villain, defend forest.
  - [ ] Palace Guard campaign: obey commander orders, defend palace.
  - [ ] Villain campaign: command own troops, order attacks on the palace.
- **E4.3 Commander / order system** `[ ]` — issue/receive orders; squad follow & attack.
- **E4.4 Economy & shops (Daggerfall-like)** `[ ]` — currency, shop UI, buy/sell, prices.
- **E4.5 Character progression** `[ ]` — stats/skills that buying & combat feed into.

### Phase 5 — Dense forest & LOD streaming `[ ]`

- **E5.1 Tree impostors** `[ ]` — billboard/impostor distant trees.
- **E5.2 Impostor→3D promotion** `[ ]` — swap to full GLB within range; hysteresis to avoid popping.
- **E5.3 Instanced vegetation** `[ ]` — thin-instances for dense forest at frame budget.
- **E5.4 Performance budget & profiling** `[ ]` — keep 60fps target on mid hardware; document budgets.

### Phase 6 — Depth & polish `[ ]`

- **E6.1 Prosthetics economy** `[ ]` — buy/fit hand/leg/eye prosthetics; wheelchair locomotion.
- **E6.2 Audio** `[ ]` — footsteps, combat, ambience (streamed).
- **E6.3 Quests / objectives** `[ ]` — per-faction objective chains.
- **E6.4 Settings & accessibility** `[ ]` — graphics quality, controls, key rebinding UI.
- **E6.5 Menu, save management, polish pass** `[ ]`.

## 4. Asset roadmap (gated, per-character only)

Models are generated **only** on concrete tickets, via the `tools/meshy-3d`
pipeline, in low-poly visual language v1.2. Near-term needs, in slice order:

1. Elf player character (Phase 1) — *already have a generic hero GLB; evaluate reuse first.* → decision folded into **FLO-299** (recommend reuse for the slice).
2. Forest tree + wooden hut (Phase 1) — **FLO-299** (Pygmalion), unblocks E1.3.
3. Empire soldier enemy (Phase 2).
4. Corpse variant (Phase 2).
5. Caravan + cargo (Phase 3).

Each asset ticket cites the visual-language doc and the licensing terms; no
speculative batches (FLO-270).

## 5. How tasks flow (delegation contract)

1. The next-up **epic** is opened as a child of FLO-273 with acceptance criteria
   and its parent phase.
2. Each **oneshot task** under it is a child of the epic, assigned to **Wayland**
   (implementation) or **Iris** (UX) with: one clear deliverable, the branch name
   (`flo-<n>-<slug>` off `main`), acceptance criteria, tests+docs required.
3. The engineer opens **one MR per task**. CTO reviews (branch isolation, tests,
   docs, visual-truth gate for UI), then merges; `main` deploys.
4. As phases complete, this document is updated (checkboxes + new tasks) and the
   tree grows. New Sub-issues from Fl0p on #2 are triaged into the right phase.

## 6. Risks & how the plan absorbs them

- **Scope is mythical.** Mitigated by phasing: a playable, deployed slice exists
  from Phase 1; every later feature is additive, never a rewrite.
- **Asset cost/time.** Per-character gating + reuse-first keeps Meshy spend bounded.
- **Browser performance with a dense forest.** Deferred to Phase 5 behind LOD &
  instancing, with an explicit frame budget; the slice ships with a sparse forest.
- **Storage limits in the browser.** IndexedDB save payloads stay small (state,
  not assets); assets always stream from static hosting.

---

*Revision history*

- **r1** (2026-06-20) — initial plan tree authored by Daedalus (CTO) from
  canonical brief #2. Pending board approval before Phase 0/1 subtasks are cut.
- **r2** (2026-06-20) — board approved r1. Phase 0 epic [FLO-277] cut with its
  three oneshots: E0.1 app shell [FLO-280] (Wayland, started), E0.2 game loop
  [FLO-281] (Wayland, blocked by E0.1), E0.3 input [FLO-282] (Aldric, blocked by
  E0.1). Phase 0 marked in progress; menu/state-machine sub-items deferred to a
  follow-up so the slice path stays the critical line.
- **r3** (2026-06-20) — Phase 0 marked **done & merged to `main`** (canonical PRs:
  canvas FLO-280/#4, loop FLO-278/#5, input FLO-279/#3, shell-cleanup FLO-283/#7;
  duplicate tickets FLO-281/282/284/285 cancelled). Menu/pause state machine
  carried forward into new prelude epic **E1.0**. Phase 1 opened as the active
  epic and delegated to the CTO to decompose into oneshot tickets — closes the
  post-Phase-0 coordination gap that stalled the tree (Prospero).
- **r4** (2026-06-20) — progress review (FLO-298). Phase 1 oneshots are in flight:
  E1.0 [FLO-292] (Aldric), E1.1 [FLO-293] (Wayland), E1.2 [FLO-294] (Soren) are
  **in progress**; E1.3/E1.4/E1.5 [FLO-295/296/297] correctly **blocked** by their
  DAG. Two gaps closed by new backlog tickets: **FLO-299** (Pygmalion) generates
  the missing forest tree + hut GLBs and resolves the elf-mesh reuse decision —
  a prerequisite for E1.3 that had no ticket; **FLO-300** (Wayland) adds the
  `npm run lint` gate to CI (`deploy.yml` ran only test+build). No PRs landed for
  Phase 1 yet. Phase 2 (combat/health) stays unticketed by design — its epic is
  opened only after the slice deploys (E1.5), per the just-in-time decomposition
  rule that kept Phase 0 from being built 3×.
