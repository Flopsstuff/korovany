import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * Display-only sprint-stamina slice (FLO-465).
 *
 * Stamina is authoritative in the engine (the character controller advances the
 * pure `stepStamina` machine every fixed step). This slice exists purely so the
 * HUD can render a bar — the controller *pushes* `setStamina` only when the
 * rounded display value changes, never 60×/s. Treat it as a projection of engine
 * state, not a source of truth (lens: trust the boundary).
 */
export interface StaminaStoreState {
  /** Current stamina for display, 0..max. */
  current: number
  /** Full stamina pool. */
  max: number
}

const PLAYER_MAX_STAMINA = 100

const initialState: StaminaStoreState = {
  current: PLAYER_MAX_STAMINA,
  max: PLAYER_MAX_STAMINA,
}

const staminaSlice = createSlice({
  name: 'stamina',
  initialState,
  reducers: {
    /** Overwrite the displayed stamina from the engine's per-frame tick. */
    setStamina(state, action: PayloadAction<{ current: number; max: number }>) {
      state.current = action.payload.current
      state.max = action.payload.max
    },
    /** Reset to a full pool (new game / restart). */
    resetStamina(state) {
      state.current = PLAYER_MAX_STAMINA
      state.max = PLAYER_MAX_STAMINA
    },
  },
})

export const { setStamina, resetStamina } = staminaSlice.actions
export const staminaReducer = staminaSlice.reducer
