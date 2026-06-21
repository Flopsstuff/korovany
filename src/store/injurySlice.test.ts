import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it } from 'vitest'
import { appReducer } from './appSlice'
import { factionReducer } from './factionSlice'
import { gameReducer } from './gameSlice'
import { streamingReducer } from './streamingSlice'
import { playerReducer } from './playerSlice'
import { healthReducer, damagePlayer } from './healthSlice'
import { inventoryReducer, pickUpLoot } from './inventorySlice'
import { progressionReducer } from './progressionSlice'
import {
  advanceBleed,
  fitPlayerProsthetic,
  injuryReducer,
  purchaseProsthetic,
  resetInjuries,
  selectHasHalfScreenBlackout,
  selectIsBleeding,
  selectIsCrawling,
  selectLocomotionSpeedMultiplier,
  severPlayerLimb,
  tickInjuries,
  treatPlayerBleeding,
  useBandage,
} from './injurySlice'

// Mirror the real store's reducer map so dispatch is typed like AppDispatch
// (the `tickInjuries` thunk reads the full RootState).
function makeStore() {
  return configureStore({
    reducer: {
      app: appReducer,
      faction: factionReducer,
      game: gameReducer,
      streaming: streamingReducer,
      player: playerReducer,
      health: healthReducer,
      injury: injuryReducer,
      inventory: inventoryReducer,
      progression: progressionReducer,
    },
  })
}

describe('injurySlice reducers', () => {
  it('severs a limb', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftLeg'))
    expect(store.getState().injury.leftLeg).toBe('severed')
  })

  it('starts bleeding when a hand is severed and stops it on treatment', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('rightHand'))
    expect(selectIsBleeding(store.getState())).toBe(true)
    store.dispatch(treatPlayerBleeding())
    expect(selectIsBleeding(store.getState())).toBe(false)
  })

  it('fits a prosthetic to clear the half-screen blackout', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftEye'))
    expect(selectHasHalfScreenBlackout(store.getState())).toBe(true)
    store.dispatch(fitPlayerProsthetic('leftEye'))
    expect(selectHasHalfScreenBlackout(store.getState())).toBe(false)
  })

  it('resets every injury', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftHand'))
    store.dispatch(severPlayerLimb('rightLeg'))
    store.dispatch(resetInjuries())
    expect(store.getState().injury).toEqual({
      leftHand: 'intact',
      rightHand: 'intact',
      leftEye: 'intact',
      rightEye: 'intact',
      leftLeg: 'intact',
      rightLeg: 'intact',
      bleeding: false,
      bleedElapsed: 0,
    })
  })

  it('advanceBleed accrues sub-interval time without damaging the slice state', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftHand'))
    store.dispatch(advanceBleed(0.5))
    expect(store.getState().injury.bleedElapsed).toBeCloseTo(0.5)
  })
})

describe('injury selectors', () => {
  it('derives the crawl outcome from a lost leg', () => {
    const store = makeStore()
    expect(selectIsCrawling(store.getState())).toBe(false)
    expect(selectLocomotionSpeedMultiplier(store.getState())).toBe(1)
    store.dispatch(severPlayerLimb('rightLeg'))
    expect(selectIsCrawling(store.getState())).toBe(true)
    expect(selectLocomotionSpeedMultiplier(store.getState())).toBeLessThan(1)
  })
})

describe('tickInjuries thunk (health wiring)', () => {
  it('does nothing when the player is not bleeding', () => {
    const store = makeStore()
    store.dispatch(tickInjuries(5))
    expect(store.getState().health.player.current).toBe(100)
  })

  it('funnels bleed damage into the health system', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftHand'))
    store.dispatch(tickInjuries(1))
    expect(store.getState().health.player.current).toBe(97)
    expect(store.getState().injury.bleedElapsed).toBeCloseTo(0)
  })

  it('bleeds the player to death when left untreated', () => {
    const store = makeStore()
    // Soften up the player so the bleed-out is quick, then open a wound.
    store.dispatch(damagePlayer(95))
    store.dispatch(severPlayerLimb('leftHand'))
    store.dispatch(tickInjuries(10)) // 10 intervals × 3 HP ≫ 5 HP remaining
    expect(store.getState().health.player.current).toBe(0)
  })

  it('stops draining HP after the bleed is treated', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftHand'))
    store.dispatch(treatPlayerBleeding())
    store.dispatch(tickInjuries(5))
    expect(store.getState().health.player.current).toBe(100)
  })
})

describe('useBandage thunk (P7.2 counterplay)', () => {
  it('spends one bandage to stop bleeding and returns true', () => {
    const store = makeStore()
    store.dispatch(pickUpLoot({ itemId: 'bandage', count: 2 }))
    store.dispatch(severPlayerLimb('leftHand')) // opens a bleeding wound
    expect(selectIsBleeding(store.getState())).toBe(true)

    const used = store.dispatch(useBandage())

    expect(used).toBe(true)
    expect(selectIsBleeding(store.getState())).toBe(false)
    expect(store.getState().inventory.counts.bandage).toBe(1)
  })

  it('is a no-op without a bandage even while bleeding', () => {
    const store = makeStore()
    store.dispatch(severPlayerLimb('leftHand'))

    const used = store.dispatch(useBandage())

    expect(used).toBe(false)
    expect(selectIsBleeding(store.getState())).toBe(true)
  })

  it('is a no-op (and keeps the bandage) when not bleeding', () => {
    const store = makeStore()
    store.dispatch(pickUpLoot({ itemId: 'bandage', count: 1 }))

    const used = store.dispatch(useBandage())

    expect(used).toBe(false)
    expect(store.getState().inventory.counts.bandage).toBe(1)
  })
})

describe('purchaseProsthetic thunk (E6.1.6 counterplay)', () => {
  it('buys and fits a prosthetic through the economy boundary', () => {
    const store = makeStore()
    store.dispatch(pickUpLoot({ itemId: 'gold', count: 150 }))
    store.dispatch(severPlayerLimb('rightLeg'))

    const result = store.dispatch(purchaseProsthetic('leg'))

    expect(result).toMatchObject({ ok: true, limb: 'rightLeg', price: 120, balance: 30 })
    expect(store.getState().inventory.counts.gold).toBe(30)
    expect(selectLocomotionSpeedMultiplier(store.getState())).toBe(1)
  })

  it('rejects unaffordable prosthetics without changing injury or gold', () => {
    const store = makeStore()
    store.dispatch(pickUpLoot({ itemId: 'gold', count: 10 }))
    store.dispatch(severPlayerLimb('leftEye'))

    const result = store.dispatch(purchaseProsthetic('eye'))

    expect(result).toEqual({ ok: false, reason: 'insufficient-funds' })
    expect(store.getState().inventory.counts.gold).toBe(10)
    expect(selectHasHalfScreenBlackout(store.getState())).toBe(true)
  })
})
