# Corpses — persistent enemy bodies (E2.4)

When an enemy dies it leaves a **persistent, static 3D corpse** in the world
instead of vanishing. No physics engine is involved — a corpse is a toppled,
inert reuse of the soldier mesh.

- Pure retention model: `src/game/corpses/corpseModel.ts`
- Session store (survives zone re-enter): `src/game/corpses/corpseStore.ts`
- Babylon spawner: `src/scenes/corpseManager.ts`
- Scene wiring: `src/scenes/forestScene.ts` (`reapDeadSoldiers`)

## Lifecycle

```
live soldier ──[HP == 0, E2.3]──▶ reapDeadSoldiers()
   │                                  │
   │  hide live mesh (setEnabled false)│ CorpseManager.registerDeath()
   ▼                                  ▼
(removed from the fight)        record in CorpseStore  ──▶  spawn static corpse mesh
                                       │                         (toppled, inert)
                                  cap exceeded?
                                       ▼
                                evict oldest record ──▶ dispose its corpse mesh
```

Each frame the forest scene calls `reapDeadSoldiers(soldiers, converted, corpses)`.
For every soldier that newly reached the `dead` phase it:

1. hides the live soldier mesh (`setEnabled(false)`) so it no longer reads as a
   combatant, and
2. hands its position + facing to `CorpseManager.registerDeath()`, which records
   the corpse and spawns a static "downed" mesh.

The conversion is **idempotent per soldier** (tracked in a `Set`), so a soldier
is never turned into two corpses.

## Corpse mesh

A corpse is a capsule (radius 0.35 m) rotated 90° onto its side, resting on the
ground, keeping the yaw the enemy faced when it fell. The soldier GLB
(`/models/empire-soldier.glb`) is mounted as a child best-effort; if the fetch
fails (or in headless tests) the toppled capsule remains as the visible
fallback.

Corpses are **inert**: `isPickable = false` and `checkCollisions = false`. They
are not registered with the fixed-step loop, so they never act, never tick, and
the melee hit sweep already filters them out (`soldiers.filter(s => !s.isDead())`).

## Retention / cleanup policy (the cap)

Corpses are capped so the mesh count — and therefore the frame budget — can
never grow unbounded. The policy is **FIFO across the session**:

- One session-wide budget of `DEFAULT_CORPSE_CAP = 32` corpses (all zones share
  it). 32 low-poly soldier bodies (~2.8k tris each) stays comfortably within the
  frame budget while still reading as a real battlefield.
- When a new corpse would exceed the cap, the **oldest** corpse is evicted: its
  record is dropped and its mesh disposed.
- The cap is configurable (`new CorpseStore(cap)`), e.g. `0` for a no-corpses
  configuration.

## Persistence

| Scope | Behaviour |
|---|---|
| Within a zone visit | Corpses stay until the cap evicts them. |
| Zone re-enter (same session) | **Persists.** The store lives at module scope, so a rebuilt scene re-spawns the corpses recorded for that zone via `CorpseManager`'s constructor. |
| Page reload | **Not persisted (out of scope).** Corpses are deliberately not written to the IndexedDB save (FLO-296) — full reload persistence would mean a save-schema migration for a cosmetic, capped, in-session feature. The store resets to empty on reload by design. |

Corpses are keyed by `zoneId`, so a corpse only re-spawns in the zone where the
enemy died — entering a different zone shows that zone's own corpses only.

## Tests

- `src/game/corpses/corpseModel.test.ts` — cap / FIFO eviction, immutability.
- `src/game/corpses/corpseStore.test.ts` — record ids, persistence, cap, reset.
- `src/scenes/corpseManager.test.ts` — mesh spawn, inert flags, eviction
  disposal, zone-scoped re-spawn (NullEngine).
- `src/scenes/forestScene.test.ts` — `reapDeadSoldiers` live→corpse transition
  and boot-time re-spawn.
