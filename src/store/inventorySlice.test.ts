import { describe, expect, it } from 'vitest'
import {
  buyItem,
  dropItem,
  equip,
  inventoryReducer,
  pickUpLoot,
  resetInventory,
  restoreInventory,
  selectGold,
  selectInventory,
  sellItem,
  unequipItem,
} from './inventorySlice'
import { buyPrice, createInventory, sellPrice, type InventoryState } from '../game/economy'

describe('inventorySlice', () => {
  it('starts empty', () => {
    expect(inventoryReducer(undefined, { type: '@@INIT' })).toEqual(createInventory())
  })

  it('pickUpLoot collects a caravan drop', () => {
    let state = inventoryReducer(undefined, pickUpLoot({ itemId: 'gold', count: 12 }))
    expect(state.counts.gold).toBe(12)
    state = inventoryReducer(state, pickUpLoot({ itemId: 'gold', count: 3 }))
    expect(state.counts.gold).toBe(15)
  })

  it('dropItem removes from a stack', () => {
    const start = inventoryReducer(undefined, pickUpLoot({ itemId: 'grain', count: 4 }))
    const after = inventoryReducer(start, dropItem({ itemId: 'grain', count: 4 }))
    expect('grain' in after.counts).toBe(false)
  })

  it('equip / unequip an equippable item', () => {
    let state = inventoryReducer(undefined, pickUpLoot({ itemId: 'blade', count: 1 }))
    state = inventoryReducer(state, equip('blade'))
    expect(state.equippedItemId).toBe('blade')
    state = inventoryReducer(state, unequipItem())
    expect(state.equippedItemId).toBeNull()
  })

  it('resetInventory clears everything', () => {
    const start = inventoryReducer(undefined, pickUpLoot({ itemId: 'cloth', count: 2 }))
    expect(inventoryReducer(start, resetInventory())).toEqual(createInventory())
  })

  it('restoreInventory overwrites from a save and decouples references', () => {
    const saved: InventoryState = { counts: { gold: 9, blade: 1 }, equippedItemId: 'blade' }
    const state = inventoryReducer(undefined, restoreInventory(saved))
    expect(state).toEqual(saved)
    expect(state.counts).not.toBe(saved.counts)
  })

  it('buyItem moves gold into goods; no-op when unaffordable', () => {
    const funded = inventoryReducer(undefined, pickUpLoot({ itemId: 'gold', count: 100 }))
    const bought = inventoryReducer(funded, buyItem({ itemId: 'cloth', quantity: 2 }))
    expect(bought.counts.cloth).toBe(2)
    expect(bought.counts.gold).toBe(100 - buyPrice('cloth', 2))

    const broke = inventoryReducer(undefined, pickUpLoot({ itemId: 'gold', count: 1 }))
    expect(inventoryReducer(broke, buyItem({ itemId: 'blade' }))).toBe(broke)
  })

  it('sellItem moves goods into gold; no-op when not carried', () => {
    const stocked = inventoryReducer(undefined, pickUpLoot({ itemId: 'cloth', count: 2 }))
    const sold = inventoryReducer(stocked, sellItem({ itemId: 'cloth', quantity: 2 }))
    expect('cloth' in sold.counts).toBe(false)
    expect(sold.counts.gold).toBe(sellPrice('cloth', 2))

    const empty = createInventory()
    expect(inventoryReducer(empty, sellItem({ itemId: 'grain' }))).toBe(empty)
  })

  it('selectGold / selectInventory read the slice', () => {
    const state = { inventory: { counts: { gold: 42, grain: 3 }, equippedItemId: null } }
    expect(selectGold(state)).toBe(42)
    expect(selectInventory(state)).toBe(state.inventory)
    expect(selectGold({ inventory: createInventory() })).toBe(0)
  })
})
