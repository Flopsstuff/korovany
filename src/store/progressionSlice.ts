import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  applyProgressionEvent,
  combatKillProgressionEvent,
  createProgression,
  damageMultiplier,
  maxHealthBonus,
  movementSpeedMultiplier,
  purchaseProgressionEvent,
  type CombatKillTarget,
  type ProgressionEvent,
  type ProgressionState,
  type PurchaseProgressionInput,
} from '../game/progression'

/**
 * Shared-state wrapper for the pure progression model.
 *
 * Reducers expose the integration hooks current and future systems need:
 * combat kills can call `recordCombatKill`; economy purchase code can call
 * `recordPurchase`; tests/tools can use `awardProgression` for explicit events.
 */

const initialState: ProgressionState = createProgression()

const progressionSlice = createSlice({
  name: 'progression',
  initialState,
  reducers: {
    recordCombatKill(state, action: PayloadAction<CombatKillTarget>) {
      return applyProgressionEvent(state, combatKillProgressionEvent(action.payload))
    },
    recordPurchase(state, action: PayloadAction<PurchaseProgressionInput>) {
      return applyProgressionEvent(state, purchaseProgressionEvent(action.payload))
    },
    awardProgression(state, action: PayloadAction<ProgressionEvent>) {
      return applyProgressionEvent(state, action.payload)
    },
    resetProgression() {
      return createProgression()
    },
    restoreProgression(_state, action: PayloadAction<ProgressionState>) {
      return {
        level: action.payload.level,
        xp: action.payload.xp,
        nextLevelXp: action.payload.nextLevelXp,
        stats: {
          strength: { ...action.payload.stats.strength },
          agility: { ...action.payload.stats.agility },
          endurance: { ...action.payload.stats.endurance },
        },
        skills: {
          melee: { ...action.payload.skills.melee },
          trade: { ...action.payload.skills.trade },
          survival: { ...action.payload.skills.survival },
        },
      }
    },
  },
})

export const {
  awardProgression,
  recordCombatKill,
  recordPurchase,
  resetProgression,
  restoreProgression,
} = progressionSlice.actions
export const progressionReducer = progressionSlice.reducer

export const selectProgression = (state: { progression: ProgressionState }): ProgressionState =>
  state.progression

export const selectDamageMultiplier = (state: { progression: ProgressionState }): number =>
  damageMultiplier(state.progression)

export const selectMaxHealthBonus = (state: { progression: ProgressionState }): number =>
  maxHealthBonus(state.progression)

export const selectMovementSpeedMultiplier = (state: { progression: ProgressionState }): number =>
  movementSpeedMultiplier(state.progression)
