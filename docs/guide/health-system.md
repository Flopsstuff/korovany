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

## Death → menu transition

`App.tsx` watches `state.health.player.current`. When it reaches 0 while the phase is `playing` or `paused`, the app dispatches `resetPlayerHealth()` (so a subsequent New Game starts with full HP) then `returnToMenu()`.

## Save persistence

Player HP survives save/load. The HP travels through the versioned save schema as the `health: { current, max }` field — see [save-system.md](save-system.md) for the slot store and `SaveData` shape.

- **Autosave** (on the playing→paused transition) writes the live `state.health.player` into the save snapshot.
- **New Game** dispatches `resetPlayerHealth()` — always starts at full HP, discarding any saved value.
- **Continue** loads the latest save and dispatches `restorePlayerHealth(data.health)` — the persisted HP is restored exactly.

Because `health` is a required field of the current schema (v1), there is no "save without HP": legacy or malformed records are rejected by `parseSaveData` and forward-migrated by `migrate` when the schema version bumps, so a loaded save always carries valid HP.

## Tests

- `src/game/health/healthModel.test.ts` — 8 unit tests (pure functions)
- `src/store/healthSlice.test.ts` — 6 Redux tests
- `src/app/App.test.tsx` — death → menu integration test
- `src/game/save/save.test.ts` — save round-trip preserves `health` (HP persistence)
