# Caravans — "грабить корованы" (E3.3)

The signature loot loop: wandering caravans the player ambushes for loot. A
caravan is a **non-combatant loot piñata** — it follows a looping path, flees
when ambushed, and on defeat rolls a loot table and emits a reward event.

Pure game logic lives in `src/game/ai/caravanFSM.ts` (the FSM),
`src/game/loot/` (loot tables), and `src/game/util/seededRandom.ts` (the seeded
PRNG). The Babylon mesh wrapper is `src/scenes/caravanEnemy.ts`.

## Behaviour states

```
wander ──[player inside ambushRadius]──────▶ flee
wander ──[takes a melee hit]───────────────▶ flee
flee   ──[player beyond calmRadius]────────▶ wander
any    ──[HP == 0]─────────────────────────▶ dead  (terminal → rolls loot)
```

| Phase | Behaviour |
|---|---|
| **wander** | Follow the looping waypoint path at 1.2 m/s |
| **flee** | Run directly away from the player at 2.6 m/s |
| **dead** | Stop; roll the loot table once and emit the drop |

The caravan deals **no damage** — the player defeats it with the existing
[E2 melee](melee-combat.md). Being struck always springs the ambush, so a sneak
hit from outside `ambushRadius` still makes it flee.

## Default parameters

| Parameter | Value |
|---|---|
| Max HP | 80 |
| Ambush radius | 6 m (player closer → flee) |
| Calm radius | 16 m (player farther → back to wander) |
| Wander speed | 1.2 m/s |
| Flee speed | 2.6 m/s |
| Arrival radius | 0.6 m (waypoint reached) |

## Pure FSM API

```ts
import { createCaravanFSM, stepCaravanFSM, applyDamageToCaravan } from '../game/ai'

let fsm = createCaravanFSM()

// Each fixed step (path is the looping list of XZ waypoints):
const { state, moveDX, moveDZ } = stepCaravanFSM(fsm, caravanPos, playerPos, dt, params, path)
fsm = state

// When the player's melee hits:
fsm = applyDamageToCaravan(fsm, 25) // → flee, or dead at 0 HP
```

## Loot tables

Loot rolls are **deterministic and seeded** — the same seed always yields the
same haul, so loot is reproducible and unit-testable.

```ts
import { rollLoot, DEFAULT_CARAVAN_LOOT } from '../game/loot'
import { createSeededRng } from '../game/util'

const drop = rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(seed))
// drop.items: [{ id, label, qty }, ...] aggregated by item id
```

A `LootTable` is `{ rolls, entries }`: it performs `rolls` independent
weighted picks, each yielding a quantity in the entry's `[minQty, maxQty]`, then
aggregates repeats into one stack per id. The default caravan haul:

| Item id | Label | Weight | Qty |
|---|---|---|---|
| `gold` | Gold coins | 50 | 5–25 |
| `grain` | Sack of grain | 30 | 1–3 |
| `cloth` | Bolt of cloth | 15 | 1–2 |
| `blade` | Looted blade | 5 | 1 |

The dropped `id`s are inventory item ids (see the E3.4 item catalog). The loot
event carries only ids + counts; display metadata is resolved from the catalog,
keeping the reward payload small.

## Reward event (consumed by the E3.4 inventory)

`CaravanEnemy` implements the `Damageable` contract from
[E2.2 melee](melee-combat.md). When the killing blow lands it rolls its table
**once** and fires `onLooted(drop)`. The caller decides what to do with the
drop — the caravan stays decoupled from the inventory. The drop is also stashed
on `caravan.loot` for inspection.

## Closing the loop: caravan → inventory → HUD (E3.5)

The caravan emits loot and the [inventory](state-management.md) consumes it, but
they speak **different, frozen shapes** on purpose (a schema is forever):

| Side | Shape |
|---|---|
| Caravan emits (`src/game/loot`) | `LootDrop = { items: LootStack[] }`, each `{ id, label, qty }` |
| Inventory accepts (`pickUpLoot`) | `{ itemId, count }` — one per stack |

A small pure adapter at the integration edge bridges them —
**`src/store/caravanLootAdapter.ts`** `caravanLootToPickups(drop)` maps each
`LootStack` to one `pickUpLoot` payload (`id → itemId`, `qty → count`). Neither
subsystem's public shape changes.

The live wiring runs in the forest zone:

```
ambush a caravan (forest scene)
  → defeat it → CaravanEnemy fires onLooted(drop)
  → createForestScene onCaravanLooted callback
  → GameCanvas: caravanLootToPickups(drop).forEach(p => dispatch(pickUpLoot(p)))
  → inventory slice accumulates the stacks
  → <InventoryPanel> re-renders the new counts in the HUD "Carried" panel
```

`createForestScene` and `createHumanLandsScene` accept an `onCaravanLooted?`
option and spawn caravans into their live zones; the player ambushes them on the
same melee path. MPG.5 guarantees the Forest boots with at least 3 caravans and
Human Lands boots with at least 2, so the loop is repeatable after a zone enter.
`GameCanvas` supplies the callback only for the live `playing` scene, so the
standalone `?dev=caravan` playground keeps logging to the console without
touching the store.

## Ambush loop (scene wiring)

```
render loop:
  1. stepMeleeAttack — advance player swing state
  2. if hitWindowOpen → getMeleeHits([caravan]) → takeDamage on each hit
  3. loop.advance → CaravanEnemy.update → stepCaravanFSM (wander/flee)
  4. on death → rollLoot → onLooted(drop)
```

## Mesh

`CaravanEnemy` uses a wide low box as a wagon stand-in (a GLB can replace it
later). On defeat the wreck tilts and darkens and stays in place.

## Dev / QA scene

Open **`?dev=caravan`** ([caravan playground](/?dev=caravan)) for a standalone
ambush scene: flat ground, one wandering caravan, full controller + camera +
melee. Walk up to it (it flees), strike with **F** until defeated; the rolled
loot is logged to the console and, in dev builds, stashed on
`window.__korovanyCaravanLoot`.

Controls: **WASD** move, **Shift** sprint, **Space** jump, **F** attack, mouse
look (click the canvas to capture the pointer).

## Tests

- `src/game/util/seededRandom.test.ts` — PRNG determinism, ranges, string seeds.
- `src/game/loot/lootTable.test.ts` — roll determinism, bounds, aggregation, weights, edge cases.
- `src/game/ai/caravanFSM.test.ts` — wander path following, ambush triggers, flee/calm, death + loot.
- `src/scenes/caravanEnemy.test.ts` — Babylon wrapper: wander, flee, one-shot loot emission, determinism.
- `src/scenes/caravanPlayground.test.ts` — full scene wiring boots and emits loot.
- `src/store/caravanLootAdapter.test.ts` — `loot → pickUpLoot` shape mapping (single,
  multi-stack, empty) and an end-to-end accumulation into the inventory slice (E3.5).
- `src/scenes/forestScene.test.ts` — the live forest zone spawns a caravan and fires
  `onCaravanLooted` exactly once on defeat (E3.5).

Browser-smoked two ways:

- **`?dev=caravan`** — the caravan wanders in real WebGL, flees on approach, and
  emits the loot event (gold/cloth/grain) when defeated.
- **Live loot loop (E3.5)** — New Game → defeat the forest caravan → the dropped
  stacks appear in the HUD **Loot** panel. The dev-only `window.__korovanyForestScene`
  handle exposes the live caravan so the join can be driven headlessly.
