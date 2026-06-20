import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { appReducer } from './appSlice'
import { factionReducer } from './factionSlice'
import { gameReducer } from './gameSlice'
import { healthReducer } from './healthSlice'
import { injuryReducer } from './injurySlice'
import { inventoryReducer } from './inventorySlice'
import { playerReducer } from './playerSlice'
import { progressionReducer } from './progressionSlice'
import { streamingReducer } from './streamingSlice'

export const store = configureStore({
  reducer: {
    app: appReducer,
    faction: factionReducer,
    game: gameReducer,
    health: healthReducer,
    injury: injuryReducer,
    inventory: inventoryReducer,
    player: playerReducer,
    progression: progressionReducer,
    streaming: streamingReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

export { continueGame, returnToMenu, startNewGame, togglePause } from './appSlice'
export type { AppPhase, AppState } from './appSlice'
export {
  adjustFactionReputation,
  resetFaction,
  restoreFaction,
  selectFactionReputation,
  selectFactionReputationMap,
  selectPlayerFaction,
  selectPlayerFactionId,
  setFactionReputation,
  setPlayerFaction,
} from './factionSlice'
export type { FactionReputationChange, FactionReputationSet, FactionState } from './factionSlice'
export { addScore, resetScore, selectScore } from './gameSlice'
export type { GameState } from './gameSlice'
export {
  damagePlayer,
  healPlayer,
  resetPlayerHealth,
  restorePlayerHealth,
} from './healthSlice'
export type { HealthStoreState } from './healthSlice'
export {
  advanceBleed,
  fitPlayerProsthetic,
  resetInjuries,
  selectHasHalfScreenBlackout,
  selectInjury,
  selectIsBleeding,
  selectIsCrawling,
  selectLocomotionSpeedMultiplier,
  severPlayerLimb,
  tickInjuries,
  treatPlayerBleeding,
} from './injurySlice'
export { restorePlayer, resetPlayer, setZone, DEFAULT_PLAYER_STATE } from './playerSlice'
export type { PlayerState } from './playerSlice'
export { setAssetPhase, selectIsStreamingLoading, selectStreamingPhases } from './streamingSlice'
export type { StreamingState } from './streamingSlice'
export {
  pickUpLoot,
  dropItem,
  equip,
  unequipItem,
  resetInventory,
  restoreInventory,
  inventoryReducer,
} from './inventorySlice'
export type { LootDrop } from './inventorySlice'
export {
  awardProgression,
  recordCombatKill,
  recordPurchase,
  resetProgression,
  restoreProgression,
  selectDamageMultiplier,
  selectMaxHealthBonus,
  selectMovementSpeedMultiplier,
  selectProgression,
} from './progressionSlice'
export type { ProgressionState } from '../game/progression'
