import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import * as injuryModel from '../game/health/injuryModel'
import type { InjuryState, Limb } from '../game/health/injuryModel'
import {
  BANDAGE_ITEM_ID,
  CURRENCY_ITEM_ID,
  buyProsthetic,
  type ProstheticKind,
} from '../game/economy'
import { damagePlayer } from './healthSlice'
import { dropItem } from './inventorySlice'
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
  },
})

export const {
  severPlayerLimb,
  treatPlayerBleeding,
  fitPlayerProsthetic,
  advanceBleed,
  resetInjuries,
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

/**
 * Dismemberment counterplay (P7.2): spend one carried bandage to stop the
 * bleeding from a severed limb. A no-op (returns `false`) when the player isn't
 * bleeding or carries no bandage, so it's safe to fire from a key press without
 * the HUD having to gate it. On success it consumes one bandage and clears the
 * bleed, returning `true` so the caller can react (e.g. play a confirmation).
 */
export const useBandage =
  () =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState()
    if (!injuryModel.isBleeding(state.injury)) return false
    if ((state.inventory.counts[BANDAGE_ITEM_ID] ?? 0) <= 0) return false
    dispatch(dropItem({ itemId: BANDAGE_ITEM_ID, count: 1 }))
    dispatch(treatPlayerBleeding())
    return true
  }

/**
 * Prosthetics shop purchase (E6.1.6): validate the repair against the current
 * injury + gold balance, debit the gold, then trust `fitPlayerProsthetic` to
 * restore the selected slot. Returns the pure shop result so UI can surface
 * insufficient funds or "already intact" without duplicating the rules.
 */
export const purchaseProsthetic =
  (kind: ProstheticKind) =>
  (dispatch: AppDispatch, getState: () => RootState): ReturnType<typeof buyProsthetic> => {
    const result = buyProsthetic(getState().inventory, getState().injury, kind)
    if (!result.ok) return result
    dispatch(dropItem({ itemId: CURRENCY_ITEM_ID, count: result.price }))
    dispatch(fitPlayerProsthetic(result.limb))
    return result
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
