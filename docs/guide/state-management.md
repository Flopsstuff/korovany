# State management

Korovany keeps all shared application state in a single [Redux Toolkit](https://redux-toolkit.js.org/)
store at `src/store/`. React UI and Babylon game systems both read and dispatch
against the same store, so the HUD and the simulation never drift out of sync.

This page is the single source of truth for the store: how it is wired, what
each slice owns, and the convention for adding a new slice. Individual systems
(health, save, asset streaming) have their own guide pages that go deeper on
domain logic; this page is the map.

## Store setup

The store is assembled in `src/store/index.ts` with `configureStore`, one
reducer per slice keyed by its state branch:

```ts
import { configureStore } from '@reduxjs/toolkit'

export const store = configureStore({
  reducer: {
    app: appReducer,
    game: gameReducer,
    health: healthReducer,
    player: playerReducer,
    streaming: streamingReducer,
  },
})
```

`main.tsx` mounts React inside a Redux `<Provider>` bound to this store. Engine
code in `src/engine/` holds a reference to the same `store` singleton, so game
systems can dispatch without React in the loop.

### Typed hooks and types

`src/store/index.ts` derives the app-wide types from the store itself and
exports pre-typed hooks. Always import these — never the bare `useSelector` /
`useDispatch` from `react-redux`:

```ts
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
```

Usage in a component:

```ts
import { useAppDispatch, useAppSelector, damagePlayer } from '../store'

const phase = useAppSelector((state) => state.app.phase)
const playerHp = useAppSelector((state) => state.health.player.current)
const dispatch = useAppDispatch()
dispatch(damagePlayer(30))
```

`RootState` is `{ app, faction, game, health, injury, inventory, player, progression, streaming }` — the union of every
slice's state. Adding a slice to `configureStore` automatically widens
`RootState`, so selectors and the typed hooks stay correct with no extra
plumbing.

### Public surface

`src/store/index.ts` re-exports every action, selector, and state type that
callers need, so the rest of the app imports from `../store` rather than
reaching into individual slice files. When you add a slice, add its exports
here too.

## Slice catalog

Each slice lives in `src/store/<name>Slice.ts` with a co-located
`<name>Slice.test.ts`. Slices created with `createSlice` use Immer, so reducer
bodies may "mutate" the draft state directly (or return a new state object).

### `appSlice` — app lifecycle

The top-level screen/phase the player is on.

- **State:** `{ phase: 'menu' | 'playing' | 'paused' }` (`AppState`, `AppPhase`).
- **Actions:** `startNewGame()`, `continueGame()`, `togglePause()`,
  `returnToMenu()` — each sets `phase`.
- **Read via:** `useAppSelector((s) => s.app.phase)` (see `App.tsx`,
  `GameCanvas.tsx`).
- **Single gate for "is the sim live".** `phase` is the one switch the forest
  simulation reads: combat (soldier AI, movement, melee) only advances while
  `playing`, and the player-death effect / bleed-out tick only fire while
  `playing`. When `paused` the scene freezes, so the player cannot take damage or
  die on the pause screen (FLO-326, see [forest-zone.md](./forest-zone.md)).

### `gameSlice` — in-run gameplay stats

Score and other per-run counters.

- **State:** `{ score: number }` (`GameState`).
- **Actions:** `addScore(n: number)`, `resetScore()`.
- **Read via:** `useAppSelector((s) => s.game.score)`.

### `factionSlice` — player faction and reputation

The Redux bridge for the pure faction model in `src/game/faction/`. It is
self-contained in E4.1: no live scene, AI targeting, or save-schema wiring reads
it yet.

- **State:** `{ playerFactionId: FactionId; reputation: ReputationMap }`
  (`FactionState`), defaulting the player to `neutral`.
- **Actions:** `setPlayerFaction(id)`, `setFactionReputation({ factionId, value })`,
  `adjustFactionReputation({ factionId, amount })`, `resetFaction()`,
  `restoreFaction(state)`.
- **Selectors:** `selectPlayerFactionId(state)`, `selectPlayerFaction(state)`,
  `selectFactionReputation(state, factionId)`, `selectFactionReputationMap(state)`.
- **Domain rules:** faction ids, definitions, reputation clamping, and
  `resolveStance(a, b)` live in [Faction system](./faction-system), not in the
  slice.

### `healthSlice` — player health

Player hit points, backed by the pure-function model in `src/game/health/`.
This is the single health authority. See [Health system](./health-system).

- **State:** `{ player: HealthState }` (`HealthStoreState`), where
  `HealthState` is `{ current: number; max: number }`.
- **Actions:** `damagePlayer(n: number)`, `healPlayer(n: number)`,
  `resetPlayerHealth()`, `restorePlayerHealth(h: HealthState)` (overwrite from a
  loaded save).
- **Read via:** `useAppSelector((s) => s.health.player.current)`.

### `playerSlice` — player progress

Player progress that no other slice or Babylon owns — currently just the
current zone id. The capsule transform lives in the scene (read through the save
`playerRuntime` bridge) and health lives in `healthSlice`; the zone id has no
other home, so it lives here for React to render and for the save format to
serialise.

- **State:** `{ zoneId: string }` (`PlayerState`); fresh-game default is
  `DEFAULT_PLAYER_STATE` (`{ zoneId: 'forest' }`).
- **Actions:** `setZone(id: string)`, `restorePlayer(p: PlayerState)` (overwrite
  from a loaded save), `resetPlayer()` (back to defaults for a New Game).
- **Read via:** `useAppSelector((s) => s.player.zoneId)`.

### `progressionSlice` — character XP, stats, and skills

The Redux bridge for the pure progression model in `src/game/progression/`.
It stores character level/XP, core stats (`strength`, `agility`, `endurance`),
and skills (`melee`, `trade`, `survival`). See
[Character progression](./character-progression).

- **State:** `ProgressionState`, persisted in save schema v3.
- **Actions:** `recordCombatKill(target)`, `recordPurchase({ value })`,
  `awardProgression(event)`, `resetProgression()`, `restoreProgression(state)`.
- **Selectors:** `selectProgression`, `selectDamageMultiplier`,
  `selectMaxHealthBonus`, `selectMovementSpeedMultiplier`.
- **Integration:** the live forest scene emits combat defeat events; economy
  purchase code should call `recordPurchase` when a buy completes.

### `streamingSlice` — asset load status

Per-asset GLB load lifecycle that drives the HUD "loading…" indicator and error
hints. See [Asset streaming](./asset-streaming).

- **State:** `{ phases: Record<string, AssetLoadPhase> }` (`StreamingState`),
  where `AssetLoadPhase` is `'idle' | 'loading' | 'loaded' | 'error'`.
- **Actions:** `setAssetPhase({ id, phase })`, `resetStreaming()`.
- **Selectors:** `selectIsStreamingLoading(state)` — true if any asset is
  mid-fetch; `selectStreamingPhases(state)` — the whole phase map.

### What the store does *not* hold

- **Save/load** is **not** a slice. The [Save system](./save-system) lives in
  `src/game/save/` (IndexedDB + a pure schema). On *Continue* it dispatches
  `restorePlayerHealth`, `restorePlayer`, `restoreInventory`, and
  `restoreProgression` to rehydrate live slices; "does a save exist?" is local
  React `useState` in `App.tsx`, not store state. The store holds *live* state;
  the save system serialises a snapshot of it.
- **The player's world transform** lives in the Babylon scene and is reached via
  the `playerRuntime` bridge, never mirrored into Redux.

## Adding a new slice

1. **Create the file.** Add `src/store/<name>Slice.ts`. Use `createSlice` with a
   `name`, a typed `initialState` and an exported `interface <Name>State`. Type
   action payloads with `PayloadAction<T>`.
2. **Export the reducer and actions.** Export the reducer as `<name>Reducer` and
   destructure `<name>Slice.actions` for the action creators. Define any
   reusable selectors as plain `(state) => …` functions in the same file.
3. **Write tests.** Add a co-located `src/store/<name>Slice.test.ts` (Vitest)
   covering the initial state and each reducer. Tests are mandatory in the same
   change — see [Project rules](./project-rules).
4. **Register in the store.** Import the reducer in `src/store/index.ts` and add
   it to the `configureStore` `reducer` map under a lowercase state key. This
   widens `RootState` automatically.
5. **Re-export the public surface.** From `src/store/index.ts`, re-export the
   slice's actions, selectors, and state type so callers import from `../store`.
6. **Document it.** Add the slice to the [Slice catalog](#slice-catalog) above
   (and a dedicated guide page if it owns non-trivial domain logic). If the
   slice holds savable state, also wire it into the [Save system](./save-system)
   restore path.

### Conventions

- One slice per concern; keep domain logic (pure functions) in `src/game/` and
  let the slice be a thin Redux wrapper — `healthSlice` is the model to follow.
- State keys in `configureStore` are lowercase; slice files are
  `<name>Slice.ts`; the `createSlice` `name` matches the state key.
- Never import `useSelector` / `useDispatch` directly — use `useAppSelector` /
  `useAppDispatch` from `../store`.
