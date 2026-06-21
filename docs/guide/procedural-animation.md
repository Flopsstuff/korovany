# Procedural Character Animation

Korovany characters animate **procedurally** (transform-based) — no skeletal rigs, no new GLB assets, no Meshy credits.

## Why procedural

Hero and soldier GLBs ship **static** (no bones, confirmed in `docs/guide/assets.md`). Skeletal rigging is a one-way-door (Meshy credit spend, board gate) deferred to a future asset ticket via Iris → Pygmalion. Procedural animation is a two-way door: easy to iterate, cheap to remove, and zero runtime overhead.

## Architecture

```
src/game/animation/
  proceduralAnimator.ts   — pure math, no Babylon import
  proceduralAnimator.test.ts
```

### Pure layer — `proceduralAnimator.ts`

Engine-agnostic. Two exports:

**`stepAnimator(state, input) → { state, output }`** — pure function, NullEngine-testable.

| Input field  | Type            | Meaning                                        |
|--------------|-----------------|------------------------------------------------|
| `dt`         | `number`        | Frame delta in seconds (respect engine timeScale) |
| `speed`      | `number`        | Horizontal speed m/s (0 = still)               |
| `attackPhase`| `AttackPhase`   | From `stepMeleeAttack` (`idle/windup/active/recovery`) |
| `isDead`     | `boolean`       | Drives topple progress                         |

| Output field | Meaning                                        |
|--------------|------------------------------------------------|
| `bobY`       | Vertical bob — add to visual root local Y      |
| `leanX`      | Forward lean — set visual root local X rotation |
| `lungeZ`     | Forward lunge — add to visual root local Z     |
| `toppleZ`    | Death topple — set visual root local Z rotation (0 → π/2) |

**`CharacterAnimator`** — thin Babylon binding. Holds a `node: AnimatableNode | null` reference (the async-loaded GLB root) and applies output offsets each frame. Set `node` after GLB load completes; it skips silently when null.

### Animations

| State      | Bob Hz | Bob amp | Lean | Lunge/Topple |
|------------|--------|---------|------|--------------|
| Idle       | 1.1    | 2.5 cm  | —    | —            |
| Moving     | 2.4    | 5.5 cm  | up to 0.12 rad | — |
| Windup     | —      | —       | —    | −5 cm pullback |
| Active     | —      | —       | —    | +18 cm lunge |
| Recovery   | —      | —       | —    | +7 cm partial |
| Dead       | —      | —       | —    | topple 0→π/2 (ease-out, ~0.5 s) |

### Death topple and slow-mo

The topple uses `dt` from the caller, which already reflects `engine.timeScale` (set by `DeathEmphasisManager`). The topple therefore naturally runs in slow-motion during the MPG.3 death emphasis window — no special coordination needed.

### Wiring

**Player (`CharacterController`)**:
- `animator: CharacterAnimator` exposed as a public field.
- Call `controller.setAttackPhase(meleeState.phase)` each frame after `stepMeleeAttack`.
- Wire `controller.animator.node` to the avatar root. The player visual is the
  flat-albedo survivor GLB (`korovany_hero_player-default.glb`), mounted
  fire-and-forget and faceted in-engine by `mountSurvivorAvatar`
  (`src/scenes/survivorAvatar.ts`, FLO-443). The load is async (mirrors
  `soldierEnemy`/`archerEnemy`), so `animator.node` is assigned in the load
  callback once the GLB resolves; gameplay runs on the invisible capsule from
  frame 0 regardless. The GLB's single welded `root` satisfies the same
  `AnimatableNode` contract, so the whole-body bob/lean/lunge/topple apply
  unchanged on the rig-less mesh.

**Soldiers (`SoldierEnemy`)**:
- `animator: CharacterAnimator` exposed as a public field.
- Driven internally in `update()` from FSM phase: chase/follow → moving, attack → active swing, dead → topple.
- Wire `animator.node` in the GLB load callback.

## Extending

To add a new animation state (e.g. stagger, block):
1. Add inputs to `AnimatorInput` and outputs to `AnimatorOutput`.
2. Add math in `stepAnimator`.
3. Add unit tests.
4. Update callers to pass the new input.

Skeletal/rigged animation remains a future enhancement (separate asset ticket through Iris → Pygmalion) — see `docs/guide/assets.md`.
