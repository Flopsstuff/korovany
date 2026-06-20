# Character progression

E4.5 adds the first additive RPG progression layer: character XP/level, core
stats, and skills. The implementation is pure and reversible so future combat,
health, and economy work can consume bonuses without this ticket rewiring damage
or max-HP rules.

Source lives in `src/game/progression/` with a thin Redux wrapper in
`src/store/progressionSlice.ts`.

## Model

The saveable `ProgressionState` contains:

| Field | Meaning |
| ----- | ------- |
| `level` | Character level derived from lifetime character XP. |
| `xp` | Lifetime character XP. |
| `nextLevelXp` | XP threshold for the next character level. |
| `stats` | Core stat tracks: `strength`, `agility`, `endurance`. Stats start at level `10`. |
| `skills` | Skill tracks: `melee`, `trade`, `survival`. Skills start at level `1`. |

Progression is awarded by `ProgressionEvent`: a source label, character XP, and
optional stat/skill XP deltas. `applyProgressionEvent` returns a fresh state and
never mutates the input.

Current event helpers:

- `combatKillProgressionEvent('soldier' | 'caravan')` — used by the combat
  defeat edge in the forest scene.
- `purchaseProgressionEvent({ value })` — the economy purchase hook for E4.4+
  buying code. It is available now even if a concrete shop UI is not wired yet.

## Store integration

`progressionSlice` exposes:

- `recordCombatKill(target)` for combat/scene defeat callbacks.
- `recordPurchase({ value })` for buying systems.
- `awardProgression(event)` for explicit event tests/tools.
- `resetProgression()` for New Game.
- `restoreProgression(state)` for Continue.

The live forest scene emits `onEnemyDefeated` when a soldier or caravan dies.
`GameCanvas` dispatches `recordCombatKill` from that edge. Loot pickup remains
separate: caravan loot still flows through `onCaravanLooted` →
`caravanLootToPickups` → `pickUpLoot`.

## Derived bonuses

Selectors expose bonuses for later consumption, but they are not applied to
damage, max HP, or movement in E4.5:

- `selectDamageMultiplier`
- `selectMaxHealthBonus`
- `selectMovementSpeedMultiplier`

That keeps this change additive. A later ticket can decide exactly where these
bonuses enter combat, health, controller speed, and UI presentation.

## Save format

Progression is persisted in save schema v4. Older saves migrate forward with a
fresh baseline progression state. Current saves round-trip the full
`ProgressionState`, so XP/stat/skill gains survive Continue.
