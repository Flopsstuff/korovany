import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'

interface GameState {
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
  },
})

export const { addScore } = gameSlice.actions

export const store = configureStore({
  reducer: {
    game: gameSlice.reducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
