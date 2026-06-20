# Enemy AI — Empire Soldier (E2.3)

The first enemy archetype is an Empire soldier with a deterministic finite-state machine (FSM). Pure game logic lives in `src/game/ai/`; the Babylon mesh wrapper in `src/scenes/soldierEnemy.ts`.

## Behaviour states

```
patrol ──[player inside detectionRadius]──▶ chase
chase  ──[player inside attackRadius]────▶ attack
chase  ──[player escapes 1.3× detection]──▶ patrol
attack ──[player outside 1.5× attackRadius]▶ chase
any    ──[HP == 0]───────────────────────▶ dead  (terminal)
```

| Phase | Behaviour |
|---|---|
| **patrol** | Wander at 1.5 m/s; change direction every 3 s |
| **chase** | Move toward player at 3 m/s |
| **attack** | Deal 15 HP every 1.5 s to the player |
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

`src/game/ai/soldierFSM.test.ts` — 15 unit tests (all phase transitions, attack cooldown, death terminal state, damage without killing, no-op after death).
