import { createSlice } from '@reduxjs/toolkit'

export type AppPhase = 'menu' | 'playing' | 'paused' | 'won' | 'lost'

export interface AppState {
  phase: AppPhase
}

const initialState: AppState = { phase: 'menu' }

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    startNewGame(state) {
      state.phase = 'playing'
    },
    continueGame(state) {
      // Resume a loaded save: the player-state restore (health/zone + staged
      // spawn transform) happens alongside this in the UI layer.
      state.phase = 'playing'
    },
    togglePause(state) {
      if (state.phase === 'playing') {
        state.phase = 'paused'
      } else if (state.phase === 'paused') {
        state.phase = 'playing'
      }
    },
    returnToMenu(state) {
      state.phase = 'menu'
    },
    /** The win objective was met (MPG.1): freeze the run on the victory screen. */
    winGame(state) {
      if (state.phase === 'playing') {
        state.phase = 'won'
      }
    },
    /** The player died (MPG.1): freeze the run on the defeat screen. */
    loseGame(state) {
      if (state.phase === 'playing') {
        state.phase = 'lost'
      }
    },
  },
})

export const { continueGame, loseGame, returnToMenu, startNewGame, togglePause, winGame } =
  appSlice.actions
export const appReducer = appSlice.reducer
