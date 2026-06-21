# Enemy AI — Empire Soldier (E2.3) & Ranged Archer (FLO-432)

The game ships two enemy archetypes, each a deterministic finite-state machine
(FSM): the melee **Empire soldier** (E2.3) and the ranged **Empire archer**
(FLO-432). Pure game logic lives in `src/game/ai/`; the Babylon mesh wrappers in
`src/scenes/soldierEnemy.ts` and `src/scenes/archerEnemy.ts`. Both reuse the same
`patrol → engage → dead` scaffolding, the same `HealthState` damage funnel, and
the same FLO-412 patrol leash — the archer is a *behaviour* variant, not a new
AI engine. The soldier is documented first; the archer section follows.

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
| **patrol** | Wander at 1.5 m/s; change direction every 3 s. **Leashed** to within `patrolLeashRadius` (6 m) of the spawn anchor — once it drifts past, it steers straight back, so a patrol guards its post instead of wandering off it (FLO-412). The wander direction is deterministic (golden-angle rotation, no wall-clock seed). |
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
| Patrol leash radius | 6 m |
| Chase speed | 3.0 m/s |
| Follow distance | 2.5 m |
| Move-to arrival radius | 0.35 m |

## Pure FSM API

```ts
import { createSoldierFSM, stepSoldierFSM, applyDamageToSoldier } from '../game/ai'

let fsm = createSoldierFSM()

// Each fixed step (pass the spawn anchor as the last arg to leash the patrol):
const { state, moveDX, moveDZ, attacked } =
  stepSoldierFSM(fsm, soldierPos, playerPos, dt, params, undefined, orderContext, anchorPos)
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
capsule placeholder stays visible. The FLO-311 GLB is a preview mesh with no
baked texture pass, so `applyEmpireSoldierTexture()` assigns an in-engine Empire
palette (green coat, brown leather, muted metal) to loaded submeshes and the
placeholder capsule uses the same coat tone. Pass `glbUrl: null` to force the
placeholder. On death the mesh topples procedurally and stays in place for E2.4
to take over.

## Spawn

Zone scenes spawn soldiers from local placement tables and register each
`SoldierEnemy` with the fixed-step scheduler. MPG.5 guarantees the Forest boots
with at least 5 soldier patrols and Human Lands boots with at least 3; Y is the
capsule half-height (`0.9`) so each patrol rests on the ground.

## Tests

`src/game/ai/orders.test.ts` covers command intake validation. `src/game/ai/soldierFSM.test.ts`
covers default FSM transitions plus ordered follow/hold/move/attack behaviours.
`src/scenes/ordersPlayground.test.ts` smoke-tests the dev scene wiring, and
`src/scenes/soldierEnemy.test.ts` covers the scene wrapper plus the in-engine
soldier material palette.

---

# Ranged Archer (FLO-432)

The second archetype is an Empire archer that **keeps its distance and looses
arrows** instead of closing to melee. It reuses the soldier's FSM scaffolding —
the same phase machine, the seed-free golden-angle patrol wander, the FLO-412
spawn-anchor leash, and the `createHealth`/`applyDamage` funnel — so it is a
behaviour variant, not a new engine. Pure logic: `src/game/ai/rangedArcherFSM.ts`;
Babylon wrapper: `src/scenes/archerEnemy.ts`.

## Behaviour states

```
patrol ──[player inside detectionRadius]──▶ engage
engage ──[player escapes 1.3× detection]──▶ patrol
engage:  too close (< minRange) ─────────▶ back-pedal (kite)
engage:  too far / no line of sight ─────▶ close the gap
engage:  in range + clear shot + off CD ─▶ fire an arrow
any    ──[HP == 0]───────────────────────▶ dead  (terminal → corpse)
```

| Phase | Behaviour |
|---|---|
| **patrol** | Identical to the soldier: golden-angle wander, leashed to `patrolLeashRadius` (6 m) of the spawn anchor (FLO-412). |
| **engage** | **Standoff kiting.** Hold `preferredRange` (8 m): back-pedal when the player crowds inside `minRange` (5 m), edge closer when beyond preferred range or when the shot is blocked. Loose an arrow on `attackCooldown` (2 s) when the player is inside `engageRange` (12 m) **and** there is a clear line of sight. The archer never enters melee range on its own. |
| **dead** | Stop all behaviour; the scene converts it to a persistent corpse (its own ranger GLB) — see [corpses.md](corpses.md). |

## Default parameters

| Parameter | Value | Note |
|---|---|---|
| Max HP | 40 | Squishier than the 60-HP soldier — a glass-cannon skirmisher |
| Detection radius | 15 m | Sees farther than the melee soldier (10 m) |
| Engage range | 12 m | Must be this close to be shot at |
| Preferred range | 8 m | The standoff distance it tries to hold |
| Min range | 5 m | Closer than this → it back-pedals |
| Attack damage | 12 HP | Per arrow |
| Attack cooldown | 2.0 s | Draw + nock time |
| Patrol speed | 1.2 m/s | |
| Reposition speed | 2.4 m/s | Kiting / closing the gap |
| Projectile speed | 20 m/s | Handed to the spawned arrow |

## Line of sight

The archer only fires with a clear shot. The pure helper
`lineOfSightClear(from, to, obstacles, padding?)`
(`src/game/combat/lineOfSight.ts`) is a segment-vs-circle test on the XZ plane:
obstacles are flat ground circles (tree trunks, hut footprints), height ignored.
The FSM consumes a single `hasLineOfSight` boolean; `ArcherEnemy` computes it from
an optional `hasLineOfSight(from, to)` callback (defaults to always-clear open
ground). With no clear shot the archer holds fire and repositions to regain it.

## Projectiles & the damage funnel

Arrows are a pure model in `src/game/combat/projectile.ts`. A `ProjectileField`
holds at most `MAX_LIVE_PROJECTILES` (24) live arrows — a hard **budget cap**:
excess shots are dropped so the frame cost can't grow unbounded. Each tick
`stepProjectileField` advances every arrow, decays its time-to-live, and reports
contacts against the registered targets *without* mutating them (mirroring
`getMeleeHits`).

The Babylon side is `ArrowVolley` (`src/scenes/arrowVolley.ts`), a `System`
registered in the fixed-step loop. On each archer's `onFire` it spawns an arrow;
each frame it resolves hits and calls `target.takeDamage(...)` on the player — the
**same `Damageable` funnel** the player's melee uses. The player target's
`takeDamage` applies the P7.1 spawn-grace scale and fires the `damageEvents`
juice bridge (hurt SFX + camera shake via `emitShake`), so no ranged-specific
feedback is special-cased. A capped mesh pool recycles one thin cylinder per live
arrow.

## Balance & seeding (P7.1)

Forest archers are seeded **behind the melee soldier wave** — both anchors sit
~34 m out, past every soldier cluster and well beyond `SAFE_SPAWN_BUFFER` (18 m)
and the archer's 15 m detection radius — so a New Game player meets a melee front
before any arrows fly and never aggros an archer from spawn. Arrow damage runs
through the same spawn-grace window as soldier melee.

## Mesh & corpse

`ArcherEnemy` mounts the **FLO-426 ranged-archer GLB**
(`/models/ranged-archer.glb`) on an invisible capsule, best-effort (the capsule
is the headless/fallback). `applyArcherTexture()` assigns a hooded-ranger palette
(mossy cloak, tan leather, bow-wood) so it reads apart from the green-coated
musketeer. On death the archer falls into a persistent corpse via the shared
`CorpseManager`, using a per-corpse GLB override (FLO-432) so a fallen archer
keeps the ranger silhouette rather than borrowing the soldier body.

## Pure FSM API

```ts
import { createArcherFSM, stepArcherFSM, applyDamageToArcher } from '../game/ai'

let fsm = createArcherFSM()
const { state, moveDX, moveDZ, fired, aimDirX, aimDirZ } =
  stepArcherFSM(fsm, archerPos, playerPos, dt, params, { hasLineOfSight, anchorPos })
fsm = state
// if (fired) → spawn a projectile heading (aimDirX, aimDirZ)
fsm = applyDamageToArcher(fsm, 25) // player melee hit
```

## Tests

`src/game/ai/rangedArcherFSM.test.ts` covers engage transitions, firing (range,
cooldown, line-of-sight gating), standoff kiting, death, and the patrol leash.
`src/game/combat/projectile.test.ts` covers arrow travel, the budget cap, and hit
resolution; `src/game/combat/lineOfSight.test.ts` the segment-vs-circle geometry.
`src/scenes/archerEnemy.test.ts` and `src/scenes/arrowVolley.test.ts` cover the
scene wrappers (firing, LOS hold, kiting, death) and the projectile→`Damageable`
funnel.
