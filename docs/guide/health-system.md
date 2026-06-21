# Health system

The health system is a pure-function model (`src/game/health/`) backed by a Redux slice (`healthSlice`). It tracks the player's current and maximum hit points and wires death to a menu transition.

## API

```ts
import { applyDamage, createHealth, healDamage, isAlive } from '../game/health'

const hp = createHealth(100)          // { current: 100, max: 100 }
const hit = applyDamage(hp, 30)       // { current: 70,  max: 100 }
const full = healDamage(hit, 30)      // { current: 100, max: 100 }
isAlive(applyDamage(hp, 9999))        // false
```

All functions are **pure** — they return a new `HealthState` and never mutate the input.

## Redux actions

| Action | Payload | Effect |
|---|---|---|
| `damagePlayer(n)` | `number` | Reduce player HP by *n*, clamp at 0 |
| `healPlayer(n)` | `number` | Restore player HP by *n*, clamp at max |
| `resetPlayerHealth()` | — | Restore player HP to max (100) |
| `restorePlayerHealth(h)` | `HealthState` | Replace player HP with a loaded `{ current, max }` (used by Continue) |

Import from `'../store'`:

```ts
import { damagePlayer, healPlayer, resetPlayerHealth, restorePlayerHealth } from '../store'
```

## HUD

While the game is not in the menu, `App.tsx` renders a health bar in the HUD
(`.hud-health`): a label, a fill bar whose width tracks `current / max`, and a
numeric `current/max` readout. The bar is an ARIA `group` labelled
`Player health: <current> of <max> hit points` for screen readers; the visual
bar itself is `aria-hidden`.

Alongside it the HUD surfaces the other built-but-previously-invisible systems
(MPG.6, FLO-366):

- **Bleeding indicator** (`.hud-bleeding`, ARIA `status`) — shown while
  `selectIsBleeding` is true, with a pulsing dot and a **conditional** prompt
  (P7.5, FLO-418): `Bleeding — use a bandage` when a `bandage` item is carried,
  otherwise an honest `Bleeding — losing HP`. It deliberately does **not** say
  "find a bandage" until the findable bandage pickup ships (P7.2, FLO-417), which
  owns refining the no-bandage copy then.
- **Score panel** (`.hud-score`, ARIA `group` "Score") — a single inline row
  `Score N · Loot N` (P7.5): **Score** (`selectScore`, the `game.score` tally)
  and **Loot** (`totalItemCount(inventory)`), tabular-nums, separated by a
  middot to match the objective row above it. Kill increments are wired by the
  objective loop (MPG.1, FLO-363); the panel surfaces the counter regardless.
- **Eye-loss vignette** (`.injury-vignette`) — a full-viewport, click-through
  overlay darkening the left half of the screen, rendered (outside the menu)
  whenever `selectHasHalfScreenBlackout` is true. It carries no `z-index`,
  relying on DOM order to sit above the canvas but below every overlay.

## Death → menu transition

`App.tsx` watches `state.health.player.current`. When it reaches 0 while the phase is `playing` or `paused`, the app dispatches `resetPlayerHealth()` (so a subsequent New Game starts with full HP) then `returnToMenu()`.

## Save persistence

Player HP survives save/load. The HP travels through the versioned save schema as the `health: { current, max }` field — see [save-system.md](save-system.md) for the slot store and `SaveData` shape.

- **Autosave** (on the playing→paused transition) writes the live `state.health.player` into the save snapshot.
- **New Game** dispatches `resetPlayerHealth()` — always starts at full HP, discarding any saved value.
- **Continue** loads the latest save and dispatches `restorePlayerHealth(data.health)` — the persisted HP is restored exactly.

Because `health` is a required field of the current schema (v1), there is no "save without HP": legacy or malformed records are rejected by `parseSaveData` and forward-migrated by `migrate` when the schema version bumps, so a loaded save always carries valid HP.

## Injury & dismemberment

Alongside hit points, the health module models **limb/organ loss** and the three
canonical outcomes from the brief (`docs/plan/game-plan.md` §0). The model is
pure (`src/game/health/injuryModel.ts`) and backed by the `injurySlice`.

### Injury state

`InjuryState` carries a status for each tracked slot plus the bleed timer:

```ts
import { createInjuryState, severLimb } from '../game/health'

const injuries = createInjuryState()        // every slot 'intact', not bleeding
severLimb(injuries, 'leftHand').bleeding     // true — a lost hand opens a wound
```

Tracked slots (`Limb`): `leftHand`, `rightHand`, `leftEye`, `rightEye`,
`leftLeg`, `rightLeg` — each `'intact' | 'severed'`.

### The three outcomes

| Brief | Trigger | Modelled as |
|---|---|---|
| **Bleed-out** | lose a hand | `bleeding` flag → `tickInjuries` drains HP each second until treated; reaching 0 HP triggers the death → menu transition |
| **Half-screen** | lose an eye | `hasHalfScreenBlackout` / `selectHasHalfScreenBlackout` — true while an eye is severed |
| **Crawl** | lose a leg | `isCrawling` / `selectLocomotionSpeedMultiplier` — speed drops to `CRAWL_SPEED_MULTIPLIER` (0.35) |

Bleed drains `BLEED_DAMAGE_PER_INTERVAL` (3) HP every `BLEED_INTERVAL_SECONDS`
(1). A prosthetic/patch (`fitProsthetic`) restores a slot to intact (clearing
the half-screen); `treatBleeding` stops a bleed without restoring the hand.

### Redux actions & selectors

| Action | Payload | Effect |
|---|---|---|
| `severPlayerLimb(limb)` | `Limb` | Sever a slot; a hand also starts bleeding |
| `treatPlayerBleeding()` | — | Stop the active bleed |
| `fitPlayerProsthetic(limb)` | `Limb` | Restore a slot to intact |
| `advanceBleed(dt)` | `number` | Advance the bleed timer (no damage funnelling) |
| `resetInjuries()` | — | Restore every slot to intact |
| `tickInjuries(dt)` *(thunk)* | `number` | Advance bleed **and** funnel damage into `health` |

Selectors: `selectInjury`, `selectIsBleeding`, `selectHasHalfScreenBlackout`,
`selectIsCrawling`, `selectLocomotionSpeedMultiplier` — all importable from
`'../store'`. As of MPG.6 (FLO-366) these are fully surfaced: the HUD renders the
bleeding indicator and eye-loss vignette (see [HUD](#hud) above), and the
locomotion multiplier reaches movement via
`CharacterController.getSpeedMultiplier`. `GameCanvas` reads
`selectLocomotionSpeedMultiplier(store.getState())` each step and passes it
(through `ZoneSceneOptions`) to the controller, which scales the per-step move
direction — so a severed leg drops the capsule to 35% speed (`CRAWL_SPEED_MULTIPLIER`).

`App.tsx` ticks `tickInjuries(1)` once a second while the player is bleeding and
the game is `playing`, and resets both health and injuries on death.

### Combat → dismemberment hook (E6.1.2)

Limbs are taken off by combat, not scripted events. The resolver lives in
`src/game/health/dismemberment.ts` — pure functions, randomness injected as an
`Rng` so it is unit-testable:

| Function | Returns | Notes |
|---|---|---|
| `dismemberChance(amount)` | `number` | 0 below `DISMEMBER_DAMAGE_THRESHOLD` (15 HP); ramps `DISMEMBER_BASE_CHANCE` + `DISMEMBER_CHANCE_PER_DAMAGE` per HP over it; capped at `DISMEMBER_MAX_CHANCE` (0.6) |
| `intactLimbs(state)` | `Limb[]` | the slots a hit can still take off |
| `shouldSever(amount, state, rng)` | `boolean` | one roll; false when no limbs remain |
| `pickLimb(state, rng)` | `Limb \| null` | uniform pick among intact limbs |
| `resolveDismemberment(amount, state, rng)` | `Limb \| null` | combines the two — the limb to sever, or `null` |

`GameCanvas.onPlayerDamaged` calls `resolveDismemberment(amount,
store.getState().injury, Math.random)` right after `damagePlayer`. On a sever it
dispatches `severPlayerLimb(limb)` — which drives the existing bleed-out /
blackout / crawl outcomes — and fires `emitDismember(limb)` on the combat event
bridge (`src/game/combat/damageEvents.ts`, `onDismember`) so downstream feedback
(audio, HUD) can subscribe without reaching into the scene. Combat is not
reproducible, so a plain `Math.random` generator is used (not the seeded RNG).

## Tests

- `src/game/health/healthModel.test.ts` — 8 unit tests (pure functions)
- `src/game/health/injuryModel.test.ts` — injury model unit tests (pure functions)
- `src/game/health/dismemberment.test.ts` — combat dismemberment resolver (chance curve, limb pick, no-op when maimed)
- `src/game/combat/damageEvents.test.ts` — dismember event pub/sub bridge
- `src/store/healthSlice.test.ts` — 6 Redux tests
- `src/store/injurySlice.test.ts` — injury slice + `tickInjuries` health-wiring tests
- `src/app/App.test.tsx` — death → menu integration test
- `src/game/save/save.test.ts` — save round-trip preserves `health` (HP persistence)
