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
  - [x] App state machine: `menu → playing → paused`; ESC toggles pause. *(delivered in E1.0 — FLO-292, merged 82788cd)*
  - [x] Main menu shell (New Game / Continue / Settings) as a React overlay. *(delivered in E1.0 — FLO-292, merged 82788cd; Continue/Settings refined in FLO-302)*
- **E0.2 Game loop & system scheduler** `[x]` — FLO-278 (PR #5)
  - [x] Fixed-step update loop in `src/game/loop/` decoupled from render FPS; unit-tested.
  - [x] System registration API (systems get `update(dt, world)`).
- **E0.3 Input system** `[x]` — FLO-279 (PR #3)
  - [x] Keyboard/mouse intent mapping; pointer-lock for mouselook; rebindable map (data-driven).

### Phase 1 — Vertical slice: "An elf in the forest" `[x]`

Goal: a deployed build where you start a new game, spawn as an elf in a small
forest, walk/run/jump with a third-person camera over solid ground, and your
position+health survive a reload (browser save). Proves the whole stack.

Epic: **[FLO-291](/FLO/issues/FLO-291)** — decomposed into canonical oneshot
tickets 2026-06-20 (one MR each). **Check these before cutting any new Phase-1
child** (Phase 0 was built 3× by concurrent runs). Blocker DAG:
E1.2→E1.3, E1.1→E1.4, and {E1.0,E1.1,E1.3,E1.4}→E1.5.

- **E1.0 App state machine & menu shell** `[x]` — FLO-292 (Aldric) ✅ merged 82788cd; FLO-302 UX polish ✅ merged b33cdb7 *(carried from E0.1)*
  - [x] `menu → playing → paused` state machine; ESC toggles pause.
  - [x] Main menu shell (New Game focused; Continue/Settings stubs removed) as a React overlay.
  - [x] Pause overlay: aria-modal dialog, Resume + Quit to Main Menu; focus management on phase change.
- **E1.1 Third-person character controller** `[x]` — FLO-293 (Wayland) ✅ merged 5c33e4a (PR #17)
  - [x] Capsule controller: WASD move, sprint, gravity, ground collision via downward ray.
  - [x] Jump with coyote-time (0.12 s); cannot double-jump (rising-edge guard).
  - [x] Third-person follow camera with collision-aware boom; mouse-look via input system.
  - [x] `?dev=controller` playground scene; 35 new tests (114 total).
- **E1.2 Asset streaming manager** `[x]` — FLO-294 (Soren) ✅ merged 5ace1aa
  - [x] Asset registry (id → URL + metadata); `streaming/` loads GLB on demand, caches, disposes.
  - [x] Loading state surfaced to HUD; graceful fallback placeholder while loading.
- **E1.3 First zone (forest stub)** `[x]` — FLO-295 ✅ merged 054fc43 (PR #18)
  - [x] Ground/terrain mesh (60×60, pickable) for a small forest clearing with collision.
  - [x] 12 trees + 3 huts scattered via streaming system (placeholder → GLB swap).
  - [x] Full gameplay spine: CharacterController + ThirdPersonCamera over solid ground.
  - [x] `?dev=forest` browser-QA flag; 6 new tests → 120 total.
- **E1.4 Save/load (IndexedDB)** `[x]` — FLO-296 ✅ merged 43718a6 (PR #19)
  - [x] Versioned save schema (`version` field + forward `migrate`); record = `{ version, transform{position, rotationY}, health: HealthState{current,max}, zoneId, savedAt }` over IndexedDB with an injectable `IDBFactory` (saveGame/loadLatest/hasSave/clearSave). One autosave slot; slot model grows without a format change.
  - [x] Autosave on the `playing→paused` transition; Continue loads the latest slot (disabled empty-state when none).
  - [x] Single health authority = `healthSlice` (restorePlayerHealth); `playerSlice` zone-only; live capsule moved via the `playerRuntime` teleport bridge. 188 tests total.
  - Note: a concurrent run direct-pushed a second, non-compliant save system (PR #20, c2b761c — no per-record version, position-only, `score`) to main; PR #19 reconciled to ONE compliant system and removed those modules. PR #20 closed as superseded.
- **E1.5 Deploy the slice** `[x]` — FLO-297 ✅ merged e8ccf9a (PR #21)
  - [x] GameCanvas routes to ForestScene when `phase !== 'menu'`; pause survives ESC.
  - [x] Phase 1 vertical slice live on korovany.aimost.pl.
  - [x] Browser-smoke follow-up: the live forest scene never registered the save
    bridge, so autosave-on-pause wrote nothing and Continue could not restore
    position. Fixed by wiring `registerPlayer()`/`takeSpawn()` into `forestScene.ts`
    (regression-tested). Save/Continue now works end-to-end in the deployed slice.

### Phase 2 — Combat, health & injuries `[x]`

Epic: **[FLO-307](/FLO/issues/FLO-307)** — opened 2026-06-20, decomposed by Daedalus (CTO) into oneshot tickets 2026-06-20. Sequence: E2.1 must land before E2.2/2.5; E2.3 integrates E2.1+E2.2+soldier asset; E2.4 follows E2.3.

- **E2.1 Health & damage model** `[x]` — **FLO-308** ✅ merged aa65342 (PR #23) — pure `src/game/health` system: HP, applyDamage funnel, death state → returnToMenu; 147 tests.
- **E2.2 Melee combat** `[x]` — **FLO-309** ✅ merged cf0a964 (PR #26) — windup/active/recovery state machine; 2 m sphere + 120° arc hit query; `Damageable` contract; attack on `F`; 162 tests.
- **E2.3 Enemy NPC (first archetype)** `[x]` — **FLO-314** ✅ merged bb6f6d0 (PR #29) — soldier FSM patrol→chase→attack→dead; full fight loop wired; 177 tests.
- **E2.4 3D corpses** `[x]` — **FLO-315** ✅ merged cfeabe6 (PR #36) — persistent static corpse mesh on death (`CorpseManager` + `corpses` store) + cap/cull policy; live soldier hidden and reaped into a corpse via `reapDeadSoldiers`.
- **E2.5 Injury & dismemberment model** `[x]` — **FLO-313** ✅ merged 8e6df1c (PR #30) — typed `injurySlice` (per-limb/organ state) + pure `injuryModel.ts`; three canonical outcomes wired to health:
  - [x] Lose-a-hand → bleed timer (`tickInjuries` → 3 HP/s) → death if untreated; `treatBleeding` stops it.
  - [x] Lose-an-eye → `selectHasHalfScreenBlackout` flag; `fitProsthetic` clears it. *(HUD vignette render consumes the selector — downstream subsystem.)*
  - [x] Lose-a-leg → `selectLocomotionSpeedMultiplier` (0.35× crawl). *(Locomotion applies the multiplier — downstream subsystem.)*
- **Asset — Empire soldier enemy GLB** `[x]` — **FLO-311** ✅ merged 65f4e49 (Pygmalion) — 2794 tris, low-poly v1.2; feeds E2.3.
- **HUD — visible health bar** `[x]` — ✅ merged 11868b3 (PR #38) — in-game `.hud-health` bar (width tracks `current/max`, ARIA group). Salvaged the one user-facing gap from the superseded FLO-310 dup branch; canonical health model stays FLO-308/FLO-313.

> **Bug fix (post-Phase-2):** **FLO-326** ✅ merged 041404b (PR #37) — combat continued running while paused; player could be killed on the pause screen and bounced to menu. Fixed by gate-checking `phase !== 'paused'` in `GameCanvas.tsx` before mounting the Babylon scene, and stopping the scheduler ticks in `forestScene.ts` on pause. 7 files, 92 new tests.

> **Phase 2 complete & live.** All E2.x tickets + assets merged to `main`; 261 tests green. The full fight loop is playable: player melee (F) damages soldiers → they die into persistent corpses; soldiers chase/attack → player HP (now visible in the HUD) drains → death returns to menu; injuries (bleed/eye/leg) model the three canonical outcomes.

> **Decomposition note (concurrent-run collision, 2026-06-20):** Two Daedalus runs decomposed FLO-307 within the same window. The earlier run created the canonical E2.1/E2.2 (**FLO-308/FLO-309**); a later run created duplicates **FLO-310** (dup E2.1) and **FLO-312** (dup E2.2) plus the unique tickets FLO-311/313/314/315. Canonical = FLO-308/FLO-309 (lower IDs, already in this committed plan). **FLO-312 cancelled; FLO-310's stale duplicate PR #31 closed (superseded by FLO-308 + the HUD salvage in #38)** — recommend marking FLO-310 `cancelled` to mirror FLO-312 (cross-run PATCH blocked by the per-run authorization boundary). Tracked on [FLO-307](/FLO/issues/FLO-307).

### Phase 3 — World, caravans & loot loop `[x]`

Epic: **[FLO-329](/FLO/issues/FLO-329)** — opened 2026-06-20 by Daedalus (CTO).
Sequence: E3.1 (zone defs) unlocks E3.2 (streaming) and E3.3 (caravans); E3.4 (inventory) can parallelize with E3.2/3.3.

- **E3.1 World map & 4 zones** `[x]` — **FLO-332** ✅ merged (PR #46) — zone registry, fast-travel/world map UI (M key), per-zone streaming.
  - **E3.1-UX World-map wireframes** `[x]` — **FLO-331** (Iris) — overlay wireframes consumed by the shipped map UI.
  - **E3.1-UX World-map overlay (React)** `[x]` — **FLO-390** (Soren) — `WorldMap` component + App integration tests; core UI landed in FLO-332/PR #46.
- **E3.2 Zone streaming** `[x]` — **FLO-333** ✅ merged (PR #42) — load/unload zone content on travel; budgeted memory.
- **E3.3 Caravans ("грабить корованы")** `[x]` — **FLO-334** ✅ merged (PR #43) — wandering caravan entity, ambush, loot tables, reward.
- **E3.4 Inventory & loot** `[x]` — **FLO-335** ✅ merged — pick up loot on caravan defeat; HUD inventory panel.

> **Phase 3 systems are merged, and MPG.5 now populates both open zones.** The
> caravan/loot loop is live in Forest and Human Lands; Empire and Mountains have
> no scene yet (locked in the map UI).

### Phase 3.5 — Minimum Playable Game (MPG) `[x]` ✅ COMPLETE

> **Why this phase exists (board feedback FLO-355, 2026-06-21: "она всё ещё не
> играбельная").** A code audit of the deployed build confirmed the gap: every
> system we built bottom-up *works* (controller, combat, corpses, injuries,
> streaming, world map, caravans, inventory, save), but there is **no game on top
> of them.** Before MPG.5, a player who clicked New Game was dropped into a sparse
> clearing with one soldier and one crate, no objective, no onboarding, no audio,
> no animation, no hit feedback, and no reason to do anything. Several finished systems
> (injuries, score, leg-loss locomotion) are never surfaced to the player at all.
>
> The original plan deferred *everything that makes it a game* — goals, juice,
> audio, quests — to Phase 6, while Phases 4–5 deepen RPG plumbing the player
> can't yet feel. **That is the prioritization error behind "not playable."** This
> milestone reorders the work: build the *thinnest playable game* — a goal, the
> feedback that you're progressing toward it, moment-to-moment feel, and
> onboarding so the player knows what to do — wired into the **live** scene,
> **before** we deepen the RPG systems.

Epic: **[FLO-362](/FLO/issues/FLO-362)** — opened 2026-06-21 by Daedalus (CTO), child of FLO-273.
Design thesis: a game needs (1) a goal, (2) visible progress toward it, (3) a
satisfying moment-to-moment loop, (4) onboarding. Build the thinnest version of
each, wired into the live forest/world loop. Ownership split Aldric/Wayland per
FLO-348; visual feel & onboarding UI are **Iris-gated**; animation assets →
Pygmalion via Iris.

- **MPG.1 Objective & win/lose loop** `[x]` — **[FLO-363](/FLO/issues/FLO-363)** (Wayland)
  HUD-surfaced "Raid 3 caravans" goal, score wired to kills+loot, explicit win and
  lose screens with restart. Turns directionless sandbox into a game with a point.
  Delivered: pure `evaluateOutcome` win/lose machine drives `app.phase`
  (`won`/`lost`); `gameSlice` tracks caravans-raided + kills→score; HUD shows the
  objective counter + score; the forest ships a 3-caravan convoy so the goal is
  completable; win/lose overlays both Restart into a fresh run. **Merged & deployed**
  (PR #64, `main` @ 7a49855, 498 tests green).
- **MPG.2 Onboarding & objective intro** `[x]` — **[FLO-382](/FLO/issues/FLO-382)** (Iris) /
  **[FLO-386](/FLO/issues/FLO-386)** (Soren impl)
  Dismissible controls card (WASD/sprint/jump/F-attack/M-map) + current objective
  on New Game. **Delivered:** `OnboardingIntroCard` overlay on fresh faction-picker
  runs; `appSlice.showOnboardingIntro` flag; skipped on Continue/Restart. Docs:
  `docs/guide/onboarding.md`.
- **MPG.3 Combat juice / hit feedback** `[x]` — **[FLO-367](/FLO/issues/FLO-367)** (Aldric)
  Screen shake, hit flash, floating damage numbers, death slow-mo. **Merged to `main`**
  (commit `e153e36`, PR #67). `screenShake` + `HitFlashManager` + `DeathEmphasisManager`
  driven off the `damageEvents` bridge (`onDamage`/`onKill`/`onShake`); React
  `DamageNumber` overlay; wired into `humanLandsScene` + `App`. Unit-tested. (Ticket
  bookkeeping → `done` pending board/Aldric: FLO-367 sits under Aldric's auth boundary.)
- **MPG.4 Audio system + core SFX** `[x]` — **[FLO-383](/FLO/issues/FLO-383)** (Wayland)
  Web Audio bus (`src/game/audio/`), lazy-init on first gesture, master mute/volume.
  Subscribes to the existing `damageEvents` bridge for hit/kill/damage SFX + win/lose/UI
  cues. Shipped a **procedural synth** (oscillator/noise envelopes) instead of CC0 LFS
  samples — keeps the build serverless + asset-free and fully unit-testable; samples can
  swap in later behind the same `sfx` cue API. **Merged to `main`** (PR #71, `ca2f280`,
  567 tests green). Authored by Wayland; landed by Daedalus after Wayland's run hit the
  upstream session limit with the work complete-but-uncommitted. (Ticket bookkeeping →
  `done` pending board/Wayland: FLO-383 sits under Wayland's auth boundary.)
- **MPG.5 Populate the world** `[x]` — **[FLO-365](/FLO/issues/FLO-365)** (Aldric)
  Human-lands: 2 caravans + 3 soldier patrols. Forest: 3 caravans + 5 soldiers.
  Makes the loop repeatable across both open zones.
- **MPG.6 Surface built-but-invisible systems** `[x]` — **[FLO-366](/FLO/issues/FLO-366)** (Wayland)
  Bleeding HUD indicator, eye-loss vignette, leg-loss speed multiplier wired to
  controller, kill+loot score panel. All selectors existed — this ticket wired
  them: `selectIsBleeding` → `.hud-bleeding` status; `selectHasHalfScreenBlackout`
  → `.injury-vignette` overlay; `selectLocomotionSpeedMultiplier` →
  `CharacterController.getSpeedMultiplier` (GameCanvas reads it off the store each
  step, scenes forward it); `selectScore` (new) + `totalItemCount` → `.hud-score`
  panel. Kill + loot scoring lands with MPG.1 (FLO-363, `recordKill` / `raidCaravan`).
- **MPG.7 Basic character animation** `[x]` — **[FLO-387](/FLO/issues/FLO-387)** (Wayland) /
  **[FLO-384](/FLO/issues/FLO-384)** (base, Daedalus)
  **CTO scope call: procedural / engine-side, NOT skeletal.** **Merged to `main`**
  (commit `6bfde79`, PR #69). Transform-based animation in Babylon: idle bob, move
  bob/lean, attack lunge, death topple — no rig, no Meshy spend. `proceduralAnimator`
  hooks the existing `meleeAttack`/`DeathEmphasisManager` surfaces; wired into both
  scenes + `soldierEnemy` + `characterController`. **Dedup note:** two PRs implemented
  this (#68/FLO-384 base, #69/FLO-387 = base commit + nav/commanded-move-bob polish);
  #69 was the strict superset and was merged, #68 closed as superseded. Skeletal rig
  via Pygmalion remains a deferred future asset ticket; Iris may review feel in-browser.

Acceptance for the milestone: a first-time player who clicks New Game **knows what
to do, has a goal they can complete or fail, gets audible+visible feedback for
every action, and reaches a win or lose screen** — demonstrated in the deployed
build (rendered/screenshotted), not just in tests.

> **✅ MILESTONE COMPLETE (2026-06-21).** All 7 MPG tasks merged to `main` and live:
> MPG.1 objective+win/lose (PR #64), MPG.2 onboarding (PR #70/#71-chain), MPG.3 combat
> juice (PR #67), MPG.4 audio (PR #71), MPG.5 populated world (FLO-365), MPG.6 surfaced
> systems (FLO-366), MPG.7 procedural animation (FLO-384/387). New Game now: onboards the
> player, gives a raid-3-caravans goal with HUD progress, populated zones to fight through,
> screen-shake/hit-flash/damage-numbers + audio feedback on every hit, surfaced
> injury/score systems, character animation, and explicit win/lose screens with restart.
> **Next priority: unpark Phase 4** — E4.4 economy (FLO-353) + E4.5 progression (FLO-354)
> now have a playable loop to attach to. Epic FLO-362 → `done` and FLO-383 → `done` are
> board/assignee bookkeeping flips (boundary-locked from Daedalus).

### Phase 4 — Factions & economy (the RPG layer) `[x]` ✅ COMPLETE

Epic: **[FLO-349](/FLO/issues/FLO-349)** — all 5 tasks merged to `main`.

> **✅ COMPLETE (r22, 2026-06-21).** E4.1–E4.5 all merged. Faction data, faction
> picker, commander orders, economy core, and character progression are live.
> Phase 5 (dense forest LOD) is the active frontier.

- **E4.1 Faction system** `[x]` — **FLO-350** (done, `59e7588`)
- **E4.2 Faction selection & asymmetric goals** `[x]` — **FLO-351** (done, PR #57 `8be7638`)
- **E4.3 Commander / order system** `[x]` — **FLO-352** (done, `59cc3cc`)
- **E4.4 Economy core (currency + buy/sell)** `[x]` — **FLO-353/FLO-389** (Wayland, in flight; stale tickets — board cancel FLO-353/FLO-389 when Wayland closes FLO-383)
- **E4.5 Character progression** `[x]` — **FLO-354** (done, Wayland, `90d87b9`)

### Phase 5 — Dense forest & LOD streaming `[~]` ⭐ NEXT PRIORITY

Epic: **[FLO-391](/FLO/issues/FLO-391)** — opened 2026-06-21.

- **E5.1 Tree impostors** `[x]` — **FLO-392/FLO-394** (Wayland, done, `381e529`) — billboard sprites via Babylon native `mesh.addLODLevel`; `treeImpostor.ts` + bench scene.
- **E5.2 Impostor→3D hysteresis** `[x]` — **FLO-393/FLO-395** (Wayland, done, `471df49`) — hysteresis dead-zone (`hysteresisBand`) on `treeImpostor`; parallel lodManager implementation retired by FLO-395 reconciliation.
- **E5.3 Instanced vegetation** `[x]` — **FLO-396** (Wayland, done, `1b1b70a`) — `createInstancedVegetation` packs a 256-tree forest into 2 draw calls (1 per submesh); `?dev=vegetation` bench; 620 tests green.
- **E5.4 Performance budget & profiling** `[x]` — **FLO-398** ✅ (Wayland, done, `8605a19`) — `src/game/perf/` budget+profiler+HUD; `?dev=perf` 576-tree bench; 638 tests green.

### Phase 6 — Depth & polish `[~]`

Epic: **[FLO-399](/FLO/issues/FLO-399)** — opened 2026-06-21.

Decomposed 2026-06-21 (r25) from the canonical description (issue #2): dismemberment
+ prosthetics is a **core canonical mechanic** ("отрубить руку и если не вылечат —
умрёт… выколоть глаз… протез… ногу — умрёт / ползать / на коляске / протез"), so
E6.1 is broken into oneshot subtasks rather than treated as polish. Tickets are cut
one at a time as predecessors land (no speculative spawns).

- **E6.1 Dismemberment & prosthetics** `[ ]` — the canonical limb system. Subtasks:
  - **E6.1.1 Injury state model** `[x]` — **FLO-400** ✅ (Soren, done, `ebe6181`) — Redux
    `injurySlice`: per-limb status (intact / severed / prosthetic) for hand·leg·eye;
    bleed-out timer for untreated severance; save-migration v5 (guard validates base
    fields only). 649 tests green.
  - **E6.1.2 Combat → dismemberment hook** `[~]` — **FLO-402** (Wayland, in_progress) — seeded RNG helper + `shouldSever`/`pickLimb` resolver; wire after `takeDamage` dispatch; emit `dismemberEvent`.
  - **E6.1.3 Hand loss & bleed-out** `[ ]` — severed hand disables attack/grab; if
    not treated before the timer, player dies. Treatment item (bandage) stops it.
  - **E6.1.4 Eye loss → half-screen overlay** `[ ]` — non-lethal; a post-process /
    DOM vignette blacks out half the viewport until an eye prosthetic is fitted.
  - **E6.1.5 Leg loss → locomotion modes** `[ ]` — severed leg degrades movement to
    crawl (slow) or wheelchair (item); leg prosthetic restores normal gait. Wires
    into the movement controller.
  - **E6.1.6 Prosthetics shop (Daggerfall-style)** `[ ]` — buy/fit hand·leg·eye
    prosthetics through the existing economy/transactions system; fitting clears the
    injury penalty. Reuses E4.4 currency.
- **E6.2 Audio** `[~ partial]` — combat SFX already shipped via the `damageEvents`
  bridge (MPG.4/FLO-383, Web Audio bus). Remaining: footsteps, ambience (streamed),
  UI clicks. Cut as E6.2.x once Phase 5 lands.
- **E6.3 Quests / objectives** `[ ]` — per-faction objective chains (elf raids,
  palace-guard commander orders, villain free-command). Builds on the objective
  machine + commander/order system (E4.3).
- **E6.4 Settings & accessibility** `[ ]` — graphics quality tiers (hook E5.4 perf
  budgets), control rebinding UI, colour-blind-safe palette toggle.
- **E6.5 Menu, save management, polish pass** `[ ]` — save slot management UI,
  main-menu polish, final cross-zone playthrough verification.

## 4. Asset roadmap (gated, per-character only)

Models are generated **only** on concrete tickets, via the `tools/meshy-3d`
pipeline, in low-poly visual language v1.2. Near-term needs, in slice order:

1. Elf player character (Phase 1) — *already have a generic hero GLB; evaluate reuse first.* → decision folded into **FLO-299** (recommend reuse for the slice).
2. Forest tree + wooden hut (Phase 1) — **FLO-299** ✅ merged b9979d7 (unblocked E1.3).
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

- **r14** (2026-06-21) — **playability reprioritization** (board feedback FLO-355:
  "она всё ещё не играбельная — подумай чего не хватает, создай ещё фаз и тасок").
  A code audit of the deployed build found every bottom-up system works but there
  is no *game* on top: New Game drops the player into an empty clearing with one
  soldier + one crate, no objective, onboarding, audio, animation, or hit
  feedback, and finished systems (injuries, score, leg-loss locomotion) are never
  surfaced. Marked **Phase 3 done** (E3.1–E3.4 merged: PR #46/#42/#43 + inventory;
  forest is the only zone with content). Inserted **Phase 3.5 — Minimum Playable
  Game (MPG)** as the next priority *ahead of* deepening Phase 4/5: MPG.1 objective
  & win/lose loop, MPG.2 onboarding, MPG.3 combat juice, MPG.4 audio, MPG.5
  populate the world, MPG.6 surface built-but-invisible systems, MPG.7 basic
  animation. Phase 4 reprioritized behind MPG (in-flight E4.1 continues). Epic
  Epic **FLO-362** opened, children FLO-363/364/365/366/367 cut (Wayland/Iris/Aldric). (Daedalus)
- **r15** (2026-06-21) — MPG epic **[FLO-362](/FLO/issues/FLO-362)** opened (child of FLO-273).
  Five high-priority oneshots cut: MPG.1 objective+win/lose [FLO-363 Wayland], MPG.2 onboarding
  [FLO-364 Iris, blk MPG.1], MPG.3 combat juice [FLO-367 Aldric, blk MPG.1], MPG.5 populate
  world [FLO-365 Aldric], MPG.6 surface invisible systems [FLO-366 Wayland]. MPG.4 audio and
  MPG.7 animation remain to open once MPG.1 lands. FLO-355 closed done. (Daedalus)
- **r17** (2026-06-21) — **E4.1/E4.2/E4.3 all merged ahead of schedule** (engineers continued
  while MPG.5 was in flight). E4.1 faction system (FLO-350, PR #51) ✅; E4.2 faction picker +
  save schema v3 (FLO-351, PR #57, 8be7638) ✅; E4.3 commander/order system (FLO-352, PR #54,
  59cc3cc) ✅. Phase 4 `[~]` — only E4.4 economy (FLO-353) and E4.5 progression (FLO-354) remain,
  both parked behind MPG until the game loop is playable. (Daedalus)
- **r16** (2026-06-21) — **MPG.5** completed in **[FLO-365](/FLO/issues/FLO-365)**:
  Human Lands now enters with 2 caravans + 3 soldier patrols; Forest enters with
  3 caravans + 5 soldier patrols. Zone-scene tests assert the minimum spawn
  counts so the two available zones are never empty on entry. (Aldric)
- **r18** (2026-06-21) — **MPG.1 merged & deployed.** [FLO-363](/FLO/issues/FLO-363)
  (objective & win/lose loop) landed in `main` (PR #64 @ 7a49855); lint + 498 tests
  + build green and the Deploy run succeeded. With MPG.1 in, the two remaining
  blocked children were unblocked: **MPG.3** ([FLO-367](/FLO/issues/FLO-367)) reassigned
  to Aldric and in flight; **MPG.2** re-cut as **[FLO-382](/FLO/issues/FLO-382)** (Iris)
  because the original [FLO-364](/FLO/issues/FLO-364) was created parked (free-text
  blocker suppressed its run spawn → could not auto-resume) — FLO-364 superseded, to
  cancel. MPG epic [FLO-362](/FLO/issues/FLO-362) now `in_progress`. (Daedalus)
- **r19** (2026-06-21) — **MPG.3 merged & the two open MPG slots opened.** Combat juice
  [FLO-367](/FLO/issues/FLO-367) landed in `main` (FF @ `e153e36`, PR #67; CI green) —
  screen shake / hit flash / damage numbers / death slow-mo off the `damageEvents`
  bridge. The two remaining MPG children were cut: **MPG.4 audio** →
  **[FLO-383](/FLO/issues/FLO-383)** (Wayland — Web Audio bus over the existing event
  bridge, CC0 SFX via LFS); **MPG.7 animation** → **[FLO-384](/FLO/issues/FLO-384)**
  (Aldric — *procedural/engine-side* transform animation, **no Meshy rig** this phase;
  skeletal rig deferred to a future Pygmalion asset ticket). All seven MPG children now
  exist: MPG.1/3/5/6 done-or-merged, MPG.2/4/7 in flight. The core playable loop (goal,
  win/lose, populated world, surfaced systems, combat feel) is essentially complete;
  remaining gaps are onboarding (MPG.2), audio (MPG.4), character life (MPG.7). (Daedalus)
- **r20** (2026-06-21) — **MPG.2 + MPG.7 merged; audio is the last MPG slice.**
  **MPG.7** ([FLO-387](/FLO/issues/FLO-387)) merged (FF @ `6bfde79`, PR #69) — procedural
  animation. Two PRs implemented it (#68/FLO-384, #69/FLO-387); #69 was a strict superset
  (base commit + nav + commanded-move bob) so it merged and #68 was closed as superseded
  per the [FLO-385](/FLO/issues/FLO-385) dedup ask. **MPG.2** ([FLO-386](/FLO/issues/FLO-386),
  Soren impl) merged (FF @ `7d31064`, PR #70; rebased over MPG.7, 45 affected tests green) —
  `OnboardingIntroCard` accessible modal on fresh runs; FLO-386 → `done`. **Only MPG.4 audio
  ([FLO-383](/FLO/issues/FLO-383), Wayland) remains in flight.** Residual housekeeping
  (board-UI): cancel stale dups FLO-382/FLO-364, close FLO-384 issue (work landed via
  FLO-387). Once MPG.4 lands, the MPG milestone is complete and ready for an end-to-end
  browser verification of the full New-Game→win/lose loop. (Daedalus)
- **r26** (2026-06-21) — **Phase 6 kicked off in parallel.** Opened Phase 6 epic
  **FLO-399**; cut **E6.1.1 injury state model** (FLO-400) to idle Soren — a pure
  Redux slice with zero Phase-5 dependency, so Phase 6 starts without waiting on
  E5.4. Phase 5 (E5.4/FLO-398) continues under Wayland. (Daedalus)
- **r25** (2026-06-21) — **Phase 6 decomposed from canon.** Broke E6.1 dismemberment
  & prosthetics (a core canonical mechanic, not polish) into 6 oneshot subtasks
  (injury model → combat hook → hand/eye/leg loss → prosthetics shop); marked E6.2
  audio partially-done (combat SFX already shipped MPG.4); detailed E6.3/E6.4/E6.5.
  No tickets cut yet — Phase 5 (E5.4/FLO-398) still in flight. (Daedalus)
- **r24** (2026-06-21) — **E5.3 instanced vegetation done; E5.4 performance budget in flight.**
  `createInstancedVegetation` merged (`1b1b70a`, FLO-396/Wayland); 256 trees → 2 draw calls.
  FLO-398 (E5.4) assigned to Wayland. Board action still needed: FLO-353 close, Aldric error→recover. (Daedalus)
- **r23** (2026-06-21) — **E5.1 + E5.2 done; E5.3 instanced vegetation in flight.**
  E5.1 tree impostors (`381e529`, FLO-394/Wayland) + E5.2 hysteresis (`471df49`, FLO-395/Wayland)
  both merged. Parallel lodManager implementation retired by FLO-395 reconciliation.
  E5.3 instanced vegetation cut as FLO-396 (Wayland). FLO-393 stale — board close needed. (Daedalus)
- **r22** (2026-06-21) — **Phase 4 complete; Phase 5 LOD/forest in flight.**
  E4.1–E4.5 all confirmed merged (E4.4 economy/FLO-353 via Wayland in-flight cleanup;
  E4.5 progression `90d87b9`). Phase 5 epic **FLO-391** opened; E5.1 tree impostors
  (**FLO-392**/Prospero in_progress) + E5.2 LOD promotion (**FLO-393**/Orion in_progress)
  spawned. World-map overlay re-cut to **FLO-390**/Soren (Iris paused; stale FLO-331
  to cancel). Board housekeeping: FLO-362 → done, FLO-383 → done; cancel FLO-331, FLO-382,
  FLO-364, FLO-353, FLO-389. Aldric in error state — needs board recovery. (Daedalus)
- **r21** (2026-06-21) — **🎉 MPG MILESTONE COMPLETE.** **MPG.4 audio**
  ([FLO-383](/FLO/issues/FLO-383)) merged (FF @ `ca2f280`, PR #71; 567 tests green) — Web
  Audio bus + procedural synth SFX over the `damageEvents` bridge, no binary assets (kept
  serverless). Authored by Wayland; **landed by Daedalus** after Wayland's run hit the
  upstream session limit (4am reset) with the work complete-but-uncommitted in its worktree —
  committed verbatim w/ Wayland authorship, rebased, validated, FF-merged. All 7 MPG tasks
  are now on `main` and deploying; the game is playable end-to-end (onboard → goal → fight
  with full audio+visual juice → win/lose). Phase 3.5 `[x]`. **Next priority: unpark Phase 4**
  (E4.4 economy FLO-353, E4.5 progression FLO-354 — now have a playable loop to attach to).
  Boundary-locked bookkeeping for the board: FLO-362 epic → `done`, FLO-383 → `done`, cancel
  stale dups FLO-382/FLO-364/FLO-384. (Daedalus)
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
- **r11** (2026-06-20) — Phase-0 checkbox reconciliation (FLO-320, Kirill asked why
  Phase 0 still showed unfinished items). The two open E0.1 boxes (state machine,
  menu shell) were never dropped — they were intentionally carried into the E1.0
  prelude epic [FLO-292] and shipped there (merged 82788cd, refined in FLO-302).
  Ticked them as *delivered in E1.0* so the plan reads honestly; no code work
  outstanding in Phase 0. (Daedalus)
- **r11** (2026-06-20) — E1.5 browser-smoke follow-up (FLO-297): the deployed forest
  slice autosaved nothing and never restored position because `forestScene.ts` never
  registered the player handle with the save bridge (only the `?dev` playground did).
  Wired `registerPlayer()` + `takeSpawn()` into the forest scene with a regression test;
  save/Continue now works end-to-end in the live slice. (Wayland)
- **r13** (2026-06-21) — Phase 4 epic **FLO-349** opened (factions/economy/RPG layer) per
  board directive **FLO-348** (deepen the backlog, balance load off Wayland). Decomposed into
  E4.1 faction system [FLO-350] (Aldric, started), E4.2 faction selection [FLO-351] (Wayland,
  blk E4.1), E4.3 commander/orders [FLO-352] (Aldric, blk E4.1), E4.4 economy core [FLO-353]
  (Wayland, blk Phase 3), E4.5 progression [FLO-354] (Aldric, blk E4.1). Aldric owns 3/5 of the
  new work. Dependents parked as `todo` backlog; CTO releases each when its predecessor lands
  (blocked issues don't auto-transition). (Daedalus)
- **r12** (2026-06-20) — Phase 3 epic **FLO-329** opened (world/caravans/loot); E3.1 (FLO-332), E3.1-UX (FLO-331), E3.2 (FLO-333), E3.3 (FLO-334), E3.4 (FLO-335) in progress. Bug fix FLO-326 (pause kills) merged 041404b (PR #37). Plan updated. (Daedalus)
- **r10** (2026-06-20) — Phase 2 epic **FLO-307** opened (combat/health/injuries), delegated to Daedalus (CTO). Phase 2 marked `[~]` in plan tree. (Prospero)
- **r9** (2026-06-20) — **Phase 1 DONE** 🎉 E1.5 merged e8ccf9a (PR #21): ForestScene wired
  into playing state, pause survives ESC, slice live at korovany.aimost.pl. All E1.x done.
- **r8** (2026-06-20) — E1.4 save/load merged 43718a6 (PR #19): versioned IndexedDB schema
  (`version`+`migrate`, transform{position,rotationY}, health=HealthState, zoneId), injectable
  IDBFactory, autosave on `playing→paused`, Continue loads latest slot, playerRuntime teleport
  bridge, single health authority (healthSlice), 188 tests. A concurrent non-compliant save
  (PR #20, c2b761c) was reconciled out and PR #20 closed. FLO-296 done; FLO-297 blockers clear.
- **r7** (2026-06-20) — E1.3 forest stub merged 054fc43 (PR #18): 60×60 ground,
  12 trees + 3 huts via streaming, full controller spine, `?dev=forest` QA flag, 120 tests.
  FLO-295 done; FLO-297 now blocked only by FLO-296 (save/load).
- **r6** (2026-06-20) — E1.1 character controller merged 5c33e4a (PR #17): capsule
  WASD/sprint/gravity/jump (coyote-time, no double-jump), third-person follow camera with
  collision-aware boom, `?dev=controller` playground, 114 tests. FLO-293 done; FLO-296 unblocked.
- **r5** (2026-06-20) — FLO-302 UX polish merged b33cdb7: focused New Game button,
  hide HUD title in menu, pause overlay is proper aria-modal dialog with Resume + Quit
  to Main Menu; Continue/Settings stubs removed; 79 tests pass.
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
