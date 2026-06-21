import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import * as injuryModel from '../game/health/injuryModel'
import type { InjuryState, Limb } from '../game/health/injuryModel'
import { damagePlayer } from './healthSlice'
import type { AppDispatch, RootState } from './index'

const injurySlice = createSlice({
  name: 'injury',
  initialState: injuryModel.createInjuryState(),
  reducers: {
    severPlayerLimb: (state, action: PayloadAction<Limb>) =>
      injuryModel.severLimb(state, action.payload),
    treatPlayerBleeding: (state) => injuryModel.treatBleeding(state),
    fitPlayerProsthetic: (state, action: PayloadAction<Limb>) =>
      injuryModel.fitProsthetic(state, action.payload),
    /** Advance bleed timers; damage funnelling is handled by `tickInjuries`. */
    advanceBleed: (state, action: PayloadAction<number>) =>
      injuryModel.tickBleed(state, action.payload).state,
    resetInjuries: () => injuryModel.createInjuryState(),
    restoreInjuries(_state, action: PayloadAction<InjuryState>) {
      return injuryModel.coerceInjuryState(action.payload)
    },
  },
})

export const {
  severPlayerLimb,
  treatPlayerBleeding,
  fitPlayerProsthetic,
  advanceBleed,
  resetInjuries,
  restoreInjuries,
} = injurySlice.actions
export const injuryReducer = injurySlice.reducer

/**
 * Advance bleed by `deltaSeconds` and funnel any whole-interval bleed damage
 * into the health system. This is the wire that lets an untreated severed hand
 * bleed the player to 0 HP, triggering the existing death → menu transition.
 *
 * Call once per game-loop tick (or per second) while the player is bleeding.
 */
export const tickInjuries =
  (deltaSeconds: number) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const before = getState().injury
    if (!before.bleeding) return
    const { damage } = injuryModel.tickBleed(before, deltaSeconds)
    dispatch(advanceBleed(deltaSeconds))
    if (damage > 0) dispatch(damagePlayer(damage))
  }

// --- Selectors --------------------------------------------------------------

export const selectInjury = (state: RootState): InjuryState => state.injury
export const selectIsBleeding = (state: RootState): boolean =>
  injuryModel.isBleeding(state.injury)
export const selectHasHalfScreenBlackout = (state: RootState): boolean =>
  injuryModel.hasHalfScreenBlackout(state.injury)
export const selectIsCrawling = (state: RootState): boolean =>
  injuryModel.isCrawling(state.injury)
export const selectLocomotionSpeedMultiplier = (state: RootState): number =>
  injuryModel.locomotionSpeedMultiplier(state.injury)
