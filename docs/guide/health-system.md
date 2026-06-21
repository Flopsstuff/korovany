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

- **Sprint stamina bar** (`.hud-stamina`, ARIA `group` "Player stamina: N of
  100") — mirrors the health bar (label, fill, numeric readout) but in a distinct
  cyan→green gradient so it does not read as health (FLO-465). It tracks the
  engine-authoritative sprint pool pushed from the character controller; see
  [sprint stamina](./character-controller.md#sprint-stamina-controllerstaminats).
- **Bleeding indicator** (`.hud-bleeding`, ARIA `status`) — shown while
  `selectIsBleeding` is true, with a pulsing dot. The prompt is conditional
  (P7.2): with no bandage carried it reads "find a bandage"; once a bandage is in
  the inventory it becomes "press **B** to bandage (N)" — see
  [Dismemberment counterplay](#dismemberment-counterplay-p72) below.
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
| **Crawl** | lose a leg | `isCrawling` / `selectLocomotionMode` → `'crawl'` — speed drops to `CRAWL_SPEED_MULTIPLIER` (0.35) |
| **Wheelchair** | lose a leg + equipped wheelchair | `selectLocomotionMode` → `'wheelchair'` — speed rises to `WHEELCHAIR_SPEED_MULTIPLIER` (0.6), still below normal gait |

Bleed drains `BLEED_DAMAGE_PER_INTERVAL` (3) HP every `BLEED_INTERVAL_SECONDS`
(1). A prosthetic/patch (`fitProsthetic`) restores a slot to intact (clearing
the half-screen and crawl penalties when no severed legs remain); `treatBleeding`
stops a bleed without restoring the hand.

### Leg-loss locomotion (E6.1.5)

When at least one leg is severed the player defaults to **crawl** mode. Carrying
and equipping a **wheelchair** from the HUD inventory upgrades movement to the
faster impaired roll without restoring a full walk. A **leg prosthetic** from the
prosthetics shop (or any `fitPlayerProsthetic` call) clears the severed slot and
returns `selectLocomotionSpeedMultiplier` to `1`.

Resolution lives in `src/game/health/locomotion.ts` and is wired through
`selectLocomotionSpeedMultiplier` / `selectLocomotionMode` so
`CharacterController.getSpeedMultiplier` and the procedural animator stay on one
path. The animator lowers the visual root and adds a forward lean in crawl, and
a seated offset in wheelchair mode.

### Prosthetics shop (E6.1.6)

The player can recover severed limbs from the live HUD via **Prosthetics** or
the `P` hotkey. The shop uses the economy's carried `gold` balance, validates
the selected prosthetic against the current `injurySlice`, then calls
`fitPlayerProsthetic(limb)` on success.

| Prosthetic | Cost | Cleared penalty |
| --- | ---: | --- |
| Hand | 80 gold pieces | Restores one severed hand slot for hand-gated actions |
| Leg | 120 gold pieces | Removes crawl slowdown once no severed legs remain |
| Eye | 60 gold pieces | Removes the half-screen blackout once no severed eyes remain |

**Wheelchair** (45 gold pieces at merchants, id `wheelchair`) is equippable
mobility gear: when a leg is lost, equip it from the HUD inventory to switch from
crawl (`0.35×`) to wheelchair (`0.6×`) until a leg prosthetic restores normal gait.

Insufficient funds disables the fitting button and leaves the `gold` stack
unchanged. See [Economy › Prosthetics shop](./economy.md#prosthetics-shop) for
the purchase rules and UI states.

### Redux actions & selectors

| Action | Payload | Effect |
|---|---|---|
| `severPlayerLimb(limb)` | `Limb` | Sever a slot; a hand also starts bleeding |
| `treatPlayerBleeding()` | — | Stop the active bleed |
| `fitPlayerProsthetic(limb)` | `Limb` | Restore a slot to intact |
| `advanceBleed(dt)` | `number` | Advance the bleed timer (no damage funnelling) |
| `resetInjuries()` | — | Restore every slot to intact |
| `tickInjuries(dt)` *(thunk)* | `number` | Advance bleed **and** funnel damage into `health` |
| `purchaseProsthetic(kind)` *(thunk)* | `'hand' \| 'leg' \| 'eye'` | Spend gold and fit the matching severed slot |

Selectors: `selectInjury`, `selectIsBleeding`, `selectHasHalfScreenBlackout`,
`selectIsCrawling`, `selectLocomotionMode`, `selectLocomotionSpeedMultiplier` — all
importable from `'../store'`. As of MPG.6 (FLO-366) these are fully surfaced: the
HUD renders the bleeding indicator and eye-loss vignette (see [HUD](#hud) above), and
the locomotion multiplier reaches movement via `CharacterController.getSpeedMultiplier`.
`GameCanvas` reads `selectLocomotionSpeedMultiplier(store.getState())` and
`selectLocomotionMode(store.getState())` each step and passes them (through
`ZoneSceneOptions`) to the controller and procedural animator — so a severed leg
drops the capsule to 35% speed (`CRAWL_SPEED_MULTIPLIER`) or 60% with a fitted
wheelchair (`WHEELCHAIR_SPEED_MULTIPLIER`).

`App.tsx` ticks `tickInjuries(1)` once a second while the player is bleeding and
the game is `playing`, and resets both health and injuries on death.

### Combat → dismemberment hook (E6.1.2)

Limbs are taken off by combat, not scripted events. The resolver lives in
`src/game/health/dismemberment.ts` — pure functions, randomness injected as an
`Rng` so it is unit-testable:

| Function | Returns | Notes |
|---|---|---|
| `dismemberChance(amount)` | `number` | 0 below `DISMEMBER_DAMAGE_THRESHOLD` (20 HP); ramps `DISMEMBER_BASE_CHANCE` (0.05) + `DISMEMBER_CHANCE_PER_DAMAGE` (0.01) per HP over it; capped at `DISMEMBER_MAX_CHANCE` (0.15) |
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

### Dismemberment counterplay (P7.2)

The hook shipped its punishment (E6.1.2) before its counterplay. P7.2 closes that
gap on two fronts:

1. **Softened odds.** The constants above were lowered so losing a limb is a rare,
   dramatic event rather than a routine outcome of every big hit: the threshold
   rose 15 → 20 HP, the per-hit cap dropped 0.6 → 0.15, and the base/ramp were
   halved. Ordinary spawn-area blows can no longer maim a fresh player.
2. **The bandage.** Bleeding can now be *stopped by the player*. `bandage` is a
   real catalog item (`BANDAGE_ITEM_ID`, `src/game/economy/items.ts`) that drops
   from caravans (`DEFAULT_CARAVAN_LOOT`). The `useBandage()` thunk
   (`src/store/injurySlice.ts`) spends one carried bandage and dispatches
   `treatPlayerBleeding()`; it's a no-op (returns `false`) when the player isn't
   bleeding or has no bandage. `App.tsx` binds it to the **B** key during play,
   and the bleeding indicator switches to "press **B** to bandage (N)" once one is
   carried — so the "find a bandage" prompt now points at an item that exists.
3. **A starting bandage (FLO-461).** A first session could still bleed out before
   any loot dropped, leaving the counterplay unreachable when it mattered most
   (FLO-453 audit). A New Game now seeds **one** bandage into the inventory via
   `createStartingInventory()` (`STARTING_BANDAGE_COUNT`, `src/game/economy/inventory.ts`),
   dispatched through `resetInventory()`. Loaded saves restore their own
   inventory (`restoreInventory`) and are unaffected, so this only guarantees the
   *first* wound has a recourse — subsequent bandages still come from caravan loot.

## Tests

- `src/game/health/healthModel.test.ts` — 8 unit tests (pure functions)
- `src/game/health/injuryModel.test.ts` — injury model unit tests (pure functions)
- `src/game/health/dismemberment.test.ts` — combat dismemberment resolver (chance curve, limb pick, no-op when maimed)
- `src/game/combat/damageEvents.test.ts` — dismember event pub/sub bridge
- `src/store/healthSlice.test.ts` — 6 Redux tests
- `src/store/injurySlice.test.ts` — injury slice + `tickInjuries` health-wiring tests
- `src/app/App.test.tsx` — death → menu integration test
- `src/game/save/save.test.ts` — save round-trip preserves `health` (HP persistence)
