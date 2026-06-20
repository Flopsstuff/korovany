import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { appReducer } from './appSlice'
import { gameReducer } from './gameSlice'
import { streamingReducer } from './streamingSlice'

export const store = configureStore({
  reducer: {
    app: appReducer,
    game: gameReducer,
    streaming: streamingReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

export { continueGame, returnToMenu, startNewGame, togglePause } from './appSlice'
export type { AppPhase, AppState } from './appSlice'
export { addScore, resetScore } from './gameSlice'
export type { GameState } from './gameSlice'
export { setAssetPhase, selectIsStreamingLoading, selectStreamingPhases } from './streamingSlice'
export type { StreamingState } from './streamingSlice'
