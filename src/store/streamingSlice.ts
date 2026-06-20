import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AssetLoadPhase } from '../game/streaming/types'

export interface StreamingState {
  /** Per-asset load phase — drives HUD "loading…" and error hints. */
  phases: Record<string, AssetLoadPhase>
}

const initialState: StreamingState = { phases: {} }

const streamingSlice = createSlice({
  name: 'streaming',
  initialState,
  reducers: {
    setAssetPhase(state, action: PayloadAction<{ id: string; phase: AssetLoadPhase }>) {
      state.phases[action.payload.id] = action.payload.phase
    },
    resetStreaming(state) {
      state.phases = {}
    },
  },
})

export const { setAssetPhase, resetStreaming } = streamingSlice.actions
export const streamingReducer = streamingSlice.reducer

/** True when any registered asset is mid-fetch. */
export const selectIsStreamingLoading = (state: { streaming: StreamingState }): boolean =>
  Object.values(state.streaming.phases).some((phase) => phase === 'loading')

export const selectStreamingPhases = (state: { streaming: StreamingState }): Record<string, AssetLoadPhase> =>
  state.streaming.phases
