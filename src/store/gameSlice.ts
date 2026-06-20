import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface GameState {
  score: number
}

const initialState: GameState = { score: 0 }

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    addScore(state, action: PayloadAction<number>) {
      state.score += action.payload
    },
    resetScore(state) {
      state.score = 0
    },
  },
})

export const { addScore, resetScore } = gameSlice.actions
export const gameReducer = gameSlice.reducer
