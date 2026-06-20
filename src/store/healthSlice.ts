import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { applyDamage, createHealth, healDamage, type HealthState } from '../game/health'

export interface HealthStoreState {
  player: HealthState
}

const PLAYER_MAX_HP = 100

const initialState: HealthStoreState = {
  player: createHealth(PLAYER_MAX_HP),
}

const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    damagePlayer(state, action: PayloadAction<number>) {
      state.player = applyDamage(state.player, action.payload)
    },
    healPlayer(state, action: PayloadAction<number>) {
      state.player = healDamage(state.player, action.payload)
    },
    resetPlayerHealth(state) {
      state.player = createHealth(PLAYER_MAX_HP)
    },
  },
})

export const { damagePlayer, healPlayer, resetPlayerHealth } = healthSlice.actions
export const healthReducer = healthSlice.reducer
