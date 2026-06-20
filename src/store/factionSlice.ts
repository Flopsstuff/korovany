import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  DEFAULT_PLAYER_FACTION_ID,
  FACTIONS,
  adjustReputation as adjustReputationValue,
  createDefaultReputation,
  setReputation as setReputationValue,
  type FactionDefinition,
  type FactionId,
  type ReputationMap,
} from '../game/faction'

export interface FactionState {
  readonly playerFactionId: FactionId
  readonly reputation: ReputationMap
}

export interface FactionReputationChange {
  readonly factionId: FactionId
  readonly amount: number
}

export interface FactionReputationSet {
  readonly factionId: FactionId
  readonly value: number
}

export const DEFAULT_FACTION_STATE: FactionState = {
  playerFactionId: DEFAULT_PLAYER_FACTION_ID,
  reputation: createDefaultReputation(),
}

function createFactionState(): FactionState {
  return {
    playerFactionId: DEFAULT_FACTION_STATE.playerFactionId,
    reputation: createDefaultReputation(),
  }
}

const factionSlice = createSlice({
  name: 'faction',
  initialState: createFactionState(),
  reducers: {
    setPlayerFaction(state, action: PayloadAction<FactionId>) {
      state.playerFactionId = action.payload
    },
    setFactionReputation(state, action: PayloadAction<FactionReputationSet>) {
      state.reputation = setReputationValue(
        state.reputation,
        action.payload.factionId,
        action.payload.value,
      )
    },
    adjustFactionReputation(state, action: PayloadAction<FactionReputationChange>) {
      state.reputation = adjustReputationValue(
        state.reputation,
        action.payload.factionId,
        action.payload.amount,
      )
    },
    resetFaction() {
      return createFactionState()
    },
    restoreFaction(_state, action: PayloadAction<FactionState>) {
      return {
        playerFactionId: action.payload.playerFactionId,
        reputation: { ...createDefaultReputation(), ...action.payload.reputation },
      }
    },
  },
})

export const {
  setPlayerFaction,
  setFactionReputation,
  adjustFactionReputation,
  resetFaction,
  restoreFaction,
} = factionSlice.actions
export const factionReducer = factionSlice.reducer

export const selectPlayerFactionId = (state: { faction: FactionState }): FactionId =>
  state.faction.playerFactionId

export const selectPlayerFaction = (state: { faction: FactionState }): FactionDefinition =>
  FACTIONS[state.faction.playerFactionId]

export const selectFactionReputation = (
  state: { faction: FactionState },
  factionId: FactionId,
): number => state.faction.reputation[factionId]

export const selectFactionReputationMap = (state: { faction: FactionState }): ReputationMap =>
  state.faction.reputation
