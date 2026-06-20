# Melee combat

The melee system is a pure state machine in `src/game/combat/` that handles the attack window, hit detection, and the `Damageable` contract. It has no Babylon or React imports — it is fully unit-testable in jsdom.

## Attack key

`F` (default binding `attack`). Edge-triggered: holding the key does not repeat.

## State machine

```
idle ──[attack pressed]──▶ windup (0.15 s)
       ──────────────────▶ active (0.10 s)  ← hitWindowOpen = true
       ──────────────────▶ recovery (0.25 s)
       ──────────────────▶ idle
```

Pressing attack during windup or recovery is a no-op (guard prevents spam).

## API

```ts
import { createMeleeAttack, stepMeleeAttack, getMeleeHits } from '../game/combat'

// Per-entity state
let attack = createMeleeAttack()

// In the game loop (fixed step):
const attackPressed = intent.attack && prevIntent.attack === false // rising edge
attack = stepMeleeAttack(attack, attackPressed, dt)

// Query hits during the active window:
if (attack.hitWindowOpen) {
  const hits = getMeleeHits(attack, casterPos, casterForward, enemyList)
  hits.forEach(h => h.takeDamage(25))
}
```

## `Damageable` contract

Any entity that can receive melee hits implements:

```ts
interface Damageable {
  position: Vec3
  takeDamage(amount: number): void
}
```

Enemy NPCs (E2.3) will implement this interface.

## Hit zone geometry

- **Radius**: 2 m sphere centred on the caster
- **Arc**: 120° frontal cone (±60° from the look direction)

Targets outside either bound are not returned by `getMeleeHits`.

## Parameters

```ts
interface MeleeAttackParams {
  windupDuration: number   // default 0.15 s
  activeDuration: number   // default 0.10 s
  recoveryDuration: number // default 0.25 s
}
```

Pass a custom `MeleeAttackParams` to `stepMeleeAttack` to override (useful for weapon variety in later phases).

## Tests

`src/game/combat/meleeAttack.test.ts` — 14 tests covering all phase transitions, edge-trigger guard, arc/range miss, multi-hit, and the `Damageable` dispatch integration.
