# Objective & win/lose loop (MPG.1)

The objective loop is what turns the forest sandbox into a *game*: a player who
clicks **New Game** is given a goal — **raid 3 caravans** — surfaced on the HUD,
and the run ends in an explicit **win** or **lose** screen with a **Restart**
button. Score (kills + loot) is tracked throughout.

## The run flow

App/run flow is the [`appSlice`](state-management.md) phase machine. MPG.1 adds
two end-of-run phases:

```
menu → playing ⇄ paused
          │
          ├── objective complete ──▶ won  ──▶ (Restart → playing | Quit → menu)
          └── player HP reaches 0 ──▶ lost ──▶ (Restart → playing | Quit → menu)
```

- `winGame` / `loseGame` only transition **from `playing`** — an already finished
  run never re-triggers, and a finished run cannot be paused.
- On `won`/`lost` the live zone scene is **unmounted**: `GameCanvas` keeps a scene
  only while `playing`/`paused`, so the win/lose overlay sits above the menu engine
  scene. Restart bumps the run and boots a **fresh** zone scene from scratch (the
  capsule, raided caravans, and corpses all reset with it).

## The win/lose state machine

The *decision* — given live progress, is the run still going, won, or lost? — is
a pure function with no Redux/React/Babylon dependency, so it is exhaustively
unit-testable:

```ts
// src/game/objective/objectiveMachine.ts
evaluateOutcome({ caravansRaided, target, playerDead }) // → 'playing' | 'won' | 'lost'
```

Death takes priority over victory, keeping the function total. The App layer
feeds it live state each frame (via the effects in `App.tsx`) and drives the
`appSlice` phase from the result.

## Objective & score state

Per-run progress lives in [`gameSlice`](state-management.md):

| Field | Meaning |
| --- | --- |
| `caravansRaided` | Caravans raided this run — drives the win objective. |
| `kills` | Soldiers defeated this run. |
| `objectiveTarget` | Caravans required to win (`OBJECTIVE_CARAVAN_TARGET`, 3). |
| `score` | Running score shown in the HUD (see below). |

**Score** accumulates as the run plays: `KILL_SCORE` (10) per soldier defeated
plus the loot points (item count) of each caravan raided. The win condition is
fed to `evaluateOutcome` from `App.tsx` (`caravansRaided >= objectiveTarget`),
not a selector — keeping the decision in the pure machine.

Actions: `recordKill`, `raidCaravan(lootPoints)`, `resetRun`. Both the New-Game
flow (after the faction picker confirms a faction) and the win/lose **Restart**
run the same full reset (`resetRun` + zone/HP/injuries/inventory) before entering
play — Restart reuses the current faction rather than re-prompting. A continued
save starts its objective fresh (objective progress is not yet persisted).

## How progress is fed from the scene

The forest scene stays decoupled from the store and reports events through
callbacks that `GameCanvas` adapts into dispatches:

- **Caravan raided** — defeating a caravan fires `onCaravanLooted(drop)`
  (see [caravans](caravans.md)). `GameCanvas` dispatches `pickUpLoot` per stack
  **and** `raidCaravan(totalItems)`, which advances the objective and folds the
  haul into the loot score. The forest ships a 3-caravan convoy so the objective
  is completable in the live build.
- **Soldier killed** — `reapDeadSoldiers` fires `onEnemyKilled` once per fresh
  death (see [enemy AI](enemy-ai.md) / [corpses](corpses.md)); `GameCanvas`
  dispatches `recordKill`.

## HUD

While playing/paused the HUD shows the objective counter (`Raid caravans — X / 3`)
and the running `Score`. The win and lose screens reuse the menu/pause overlay
chrome with win- and lose-tinted accents.

## Tests

- `src/game/objective/objectiveMachine.test.ts` — the win/lose state machine,
  including the death-priority and zero-target edges.
- `src/store/gameSlice.test.ts` — objective/score reducers and selectors.
- `src/store/appSlice.test.ts` — `won`/`lost` transitions and guards.
- `src/app/App.test.tsx` — HUD objective/score, win and lose screens, and the
  end-to-end **Restart from win → fresh game** flow.
