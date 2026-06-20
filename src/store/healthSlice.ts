import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SavePayload } from '../game/save'
import {
  DEFAULT_MAX_HP,
  applyDamage,
  createHealth,
  healDamage,
  type HealthState,
} from '../game/health'

export type { HealthState }

const initialState: HealthState = createHealth()

const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    /**
     * Initialise player health from a loaded save (restoring `hp`) or, when
     * no save is supplied, reset to a full-health default. Dispatched on New
     * Game and Continue.
     */
    initHealth(_state, action: PayloadAction<SavePayload | null | undefined>) {
      const hp = action.payload?.hp
      return createHealth(DEFAULT_MAX_HP, hp ?? DEFAULT_MAX_HP)
    },
    /** Apply damage to the player (negative amounts ignored). */
    damagePlayer(state, action: PayloadAction<number>) {
      return applyDamage(state, action.payload)
    },
    /** Heal the player (negative amounts ignored). */
    healPlayer(state, action: PayloadAction<number>) {
      return healDamage(state, action.payload)
    },
  },
})

export const { initHealth, damagePlayer, healPlayer } = healthSlice.actions
export const healthReducer = healthSlice.reducer

export const selectHealth = (state: { health: HealthState }): HealthState => state.health
export const selectPlayerHp = (state: { health: HealthState }): number => state.health.currentHp
export const selectIsPlayerAlive = (state: { health: HealthState }): boolean => state.health.alive
