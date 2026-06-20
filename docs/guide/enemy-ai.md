# Enemy AI — Empire Soldier (E2.3)

The first enemy archetype is an Empire soldier with a deterministic finite-state machine (FSM). Pure game logic lives in `src/game/ai/`; the Babylon mesh wrapper in `src/scenes/soldierEnemy.ts`.

## Behaviour states

```
patrol ──[player inside detectionRadius]──▶ chase
chase  ──[player inside attackRadius]────▶ attack
chase  ──[player escapes 1.3× detection]──▶ patrol
attack ──[player outside 1.5× attackRadius]▶ chase
order  ──[follow/hold/move-to/attack-target]▶ ordered behaviour
order cleared ─────────────────────────────▶ patrol
any    ──[HP == 0]───────────────────────▶ dead  (terminal)
```

| Phase | Behaviour |
|---|---|
| **patrol** | Wander at 1.5 m/s; change direction every 3 s |
| **chase** | Move toward player at 3 m/s |
| **attack** | Deal 15 HP every 1.5 s to the player |
| **follow** | Follow a commander until inside the follow distance |
| **hold** | Hold position until a new order arrives or the order is cleared |
| **move-to** | Move to an ordered destination, then hold |
| **attack-target** | Attack the ordered hostile target; if it disappears or dies, hold |
| **dead** | Stop all behaviour; the scene converts it to a persistent corpse — see [corpses.md](corpses.md) (E2.4) |

## Default parameters

| Parameter | Value |
|---|---|
| Max HP | 60 |
| Detection radius | 10 m |
| Attack radius | 1.8 m |
| Attack damage | 15 HP |
| Attack cooldown | 1.5 s |
| Patrol speed | 1.5 m/s |
| Chase speed | 3.0 m/s |
| Follow distance | 2.5 m |
| Move-to arrival radius | 0.35 m |

## Pure FSM API

```ts
import { createSoldierFSM, stepSoldierFSM, applyDamageToSoldier } from '../game/ai'

let fsm = createSoldierFSM()

// Each fixed step:
const { state, moveDX, moveDZ, attacked } = stepSoldierFSM(fsm, soldierPos, playerPos, dt)
fsm = state

// When player melee hits:
fsm = applyDamageToSoldier(fsm, 25)
```

## Commander orders (E4.3)

Pure command intake lives in `src/game/ai/orders.ts`. A commander issues one of
four order types to same-faction subordinates:

| Order | Intake validation | Soldier behaviour |
|---|---|---|
| `follow` | Recipient must be alive, same faction, and assigned to the commander | Move toward the commander until inside `followDistance` |
| `hold` | Same recipient checks | Stop moving and wait |
| `move-to` | Same recipient checks; destination must be finite | Move to the destination, then transition to `hold` |
| `attack-target` | Same recipient checks; target must exist, be alive, and be hostile by `resolveStance` | Move into attack radius, deal ordered-target damage, then hold if the target is gone |

The boundary is deliberate: `issueSquadOrder()` rejects invalid recipients,
destinations, and non-hostile targets up front. `SoldierEnemy` and
`stepSoldierFSM()` then consume a compact `SoldierOrderContext` and trust it,
instead of re-running faction checks every frame. When an order is cleared, an
ordered soldier resumes default patrol/aggro behaviour.

`?dev=orders` opens a standalone commander playground. It scripts the same
intake path through `follow`, `move-to`, and `attack-target` orders against a
hostile target, without changing default forest gameplay.

## Damageable contract

`SoldierEnemy` implements the `Damageable` interface from E2.2 (melee combat). The player's `getMeleeHits` call returns living `SoldierEnemy` instances; the caller invokes `takeDamage(amount)` on each.

## Fight loop (ForestScene wiring)

```
render loop:
  1. stepMeleeAttack — advance player swing state
  2. if hitWindowOpen → getMeleeHits → takeDamage on each hit soldier
  3. loop.advance → runs SoldierEnemy.update → stepSoldierFSM
  4. if attacked → onPlayerDamaged(15) → dispatch(damagePlayer(15))
  5. if player HP == 0 → App.tsx death handler → returnToMenu
```

## Mesh

`SoldierEnemy` carries an invisible capsule as its position/collision proxy and
mounts the **FLO-311 Empire soldier GLB** (`/models/empire-soldier.glb`) onto it,
mirroring how the hero model is parented to the player capsule. The GLB load is
best-effort: if the model can't be fetched (e.g. headless tests), the bare
capsule placeholder stays visible. Pass `glbUrl: null` to force the placeholder.
On death the mesh topples (rotates 90°) and stays in place for E2.4 to take over.

## Spawn

One soldier is spawned at `(6, 0.9, 6)` in ForestScene (Y is the capsule
half-height so it rests on the ground). To spawn more, push additional
`SoldierEnemy` instances into the scene and register them with the scheduler.

## Tests

`src/game/ai/orders.test.ts` covers command intake validation. `src/game/ai/soldierFSM.test.ts`
covers default FSM transitions plus ordered follow/hold/move/attack behaviours.
`src/scenes/ordersPlayground.test.ts` smoke-tests the dev scene wiring.
