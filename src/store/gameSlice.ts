import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './index'

/**
 * Per-run game state: the win objective and the running score (MPG.1).
 *
 * The "is this run won/lost?" decision lives in the pure
 * {@link ../game/objective/objectiveMachine}; this slice only holds the live
 * progress (caravans raided, kills) and the derived score the HUD shows. The App
 * feeds `caravansRaided` + player HP into the machine each frame and drives the
 * `appSlice` phase from the result.
 */
export interface GameState {
  /** Enemy soldiers defeated this run. */
  kills: number
  /** Caravans raided this run — the win-objective progress. */
  caravansRaided: number
  /** Caravans the player must raid to win the run. */
  objectiveTarget: number
  /** Running score shown in the HUD: kills + looted goods. */
  score: number
}

/** Caravans the player must raid to win a run (the MPG.1 objective). */
export const OBJECTIVE_CARAVAN_TARGET = 3
/** Score awarded per enemy soldier defeated. */
export const KILL_SCORE = 10

const initialState: GameState = {
  kills: 0,
  caravansRaided: 0,
  objectiveTarget: OBJECTIVE_CARAVAN_TARGET,
  score: 0,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    /** An enemy soldier was defeated: bump kills and award kill points. */
    recordKill(state) {
      state.kills += 1
      state.score += KILL_SCORE
    },
    /**
     * A caravan was raided. Advances the win objective and adds the haul's loot
     * points (payload) to the score.
     */
    raidCaravan(state, action: PayloadAction<number>) {
      state.caravansRaided += 1
      state.score += action.payload
    },
    /** Reset all run state for a fresh game (New Game / Restart). */
    resetRun() {
      return initialState
    },
  },
})

export const { recordKill, raidCaravan, resetRun } = gameSlice.actions
export const gameReducer = gameSlice.reducer

// --- Selectors --------------------------------------------------------------

/**
 * Running game score surfaced in the HUD score panel. Fed by `recordKill`
 * (kill points) and `raidCaravan` (loot points) from the objective loop
 * (FLO-363/MPG.1); the HUD score panel was introduced in MPG.6 (FLO-366).
 */
export const selectScore = (state: RootState): number => state.game.score
