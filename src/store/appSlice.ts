import { createSlice } from '@reduxjs/toolkit'

export type AppPhase = 'menu' | 'playing' | 'paused'

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
  },
})

export const { continueGame, returnToMenu, startNewGame, togglePause } = appSlice.actions
export const appReducer = appSlice.reducer
