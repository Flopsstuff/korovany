import { describe, expect, it } from 'vitest'
import { FACTION_IDS, MAX_REPUTATION, MIN_REPUTATION, createDefaultReputation } from '../game/faction'
import {
  DEFAULT_FACTION_STATE,
  adjustFactionReputation,
  factionReducer,
  resetFaction,
  restoreFaction,
  selectFactionReputation,
  selectFactionReputationMap,
  selectPlayerFaction,
  selectPlayerFactionId,
  setFactionReputation,
  setPlayerFaction,
  type FactionState,
} from './factionSlice'

describe('factionSlice', () => {
  it('starts with neutral player faction and default reputation', () => {
    expect(factionReducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_FACTION_STATE)
  })

  it('sets the current player faction', () => {
    const state = factionReducer(undefined, setPlayerFaction(FACTION_IDS.ForestElves))

    expect(state.playerFactionId).toBe(FACTION_IDS.ForestElves)
  })

  it('sets and adjusts clamped reputation', () => {
    let state = factionReducer(
      undefined,
      setFactionReputation({ factionId: FACTION_IDS.Empire, value: 250 }),
    )
    expect(state.reputation[FACTION_IDS.Empire]).toBe(MAX_REPUTATION)

    state = factionReducer(
      state,
      adjustFactionReputation({ factionId: FACTION_IDS.Empire, amount: -250 }),
    )
    expect(state.reputation[FACTION_IDS.Empire]).toBe(MIN_REPUTATION)
  })

  it('resets faction state', () => {
    const changed = factionReducer(undefined, setPlayerFaction(FACTION_IDS.Villain))

    expect(factionReducer(changed, resetFaction())).toEqual(DEFAULT_FACTION_STATE)
  })

  it('restores faction state and fills missing reputation defaults', () => {
    const saved: FactionState = {
      playerFactionId: FACTION_IDS.Empire,
      reputation: { neutral: 10, empire: 20, forestElves: -20, villain: -80 },
    }
    const state = factionReducer(undefined, restoreFaction(saved))

    expect(state).toEqual(saved)
    expect(state.reputation).not.toBe(saved.reputation)
  })

  it('selectors expose player faction and reputation', () => {
    const state = factionReducer(
      undefined,
      setFactionReputation({ factionId: FACTION_IDS.ForestElves, value: 35 }),
    )
    const root = { faction: factionReducer(state, setPlayerFaction(FACTION_IDS.ForestElves)) }

    expect(selectPlayerFactionId(root)).toBe(FACTION_IDS.ForestElves)
    expect(selectPlayerFaction(root).name).toBe('Forest Elves')
    expect(selectFactionReputation(root, FACTION_IDS.ForestElves)).toBe(35)
    expect(selectFactionReputationMap(root)).toEqual({
      ...createDefaultReputation(),
      forestElves: 35,
    })
  })
})
