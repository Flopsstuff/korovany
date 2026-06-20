import { describe, expect, it } from 'vitest'
import type { LootDrop as CaravanLootDrop } from '../game/loot'
import { caravanLootToPickups } from './caravanLootAdapter'
import { inventoryReducer, pickUpLoot } from './inventorySlice'
import { createInventory, totalItemCount } from '../game/economy'

describe('caravanLootToPickups', () => {
  it('maps a single stack to one pickUpLoot payload (id→itemId, qty→count)', () => {
    const drop: CaravanLootDrop = { items: [{ id: 'gold', label: 'Gold coins', qty: 17 }] }

    expect(caravanLootToPickups(drop)).toEqual([{ itemId: 'gold', count: 17 }])
  })

  it('maps a multi-stack drop to one payload per stack, preserving order', () => {
    const drop: CaravanLootDrop = {
      items: [
        { id: 'gold', label: 'Gold coins', qty: 12 },
        { id: 'grain', label: 'Sack of grain', qty: 3 },
        { id: 'blade', label: 'Looted blade', qty: 1 },
      ],
    }

    expect(caravanLootToPickups(drop)).toEqual([
      { itemId: 'gold', count: 12 },
      { itemId: 'grain', count: 3 },
      { itemId: 'blade', count: 1 },
    ])
  })

  it('maps an empty drop to no pickups', () => {
    expect(caravanLootToPickups({ items: [] })).toEqual([])
  })

  it('feeds the inventory slice end-to-end: each payload accumulates into stacks', () => {
    const drop: CaravanLootDrop = {
      items: [
        { id: 'gold', label: 'Gold coins', qty: 8 },
        { id: 'cloth', label: 'Bolt of cloth', qty: 2 },
      ],
    }

    // Replay the wiring GameCanvas does: one dispatch per mapped pickup.
    let state = createInventory()
    for (const pickup of caravanLootToPickups(drop)) {
      state = inventoryReducer(state, pickUpLoot(pickup))
    }

    expect(state.counts).toEqual({ gold: 8, cloth: 2 })
    expect(totalItemCount(state)).toBe(10)
  })
})
