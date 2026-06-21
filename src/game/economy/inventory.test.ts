import { describe, expect, it } from 'vitest'
import {
  addItem,
  createInventory,
  createStartingInventory,
  equipItem,
  isInventoryEmpty,
  isInventoryState,
  listStacks,
  removeItem,
  STARTING_BANDAGE_COUNT,
  totalItemCount,
  unequip,
} from './inventory'
import { BANDAGE_ITEM_ID } from './items'

describe('createInventory', () => {
  it('starts empty with nothing equipped', () => {
    const inv = createInventory()
    expect(inv).toEqual({ counts: {}, equippedItemId: null })
    expect(isInventoryEmpty(inv)).toBe(true)
    expect(totalItemCount(inv)).toBe(0)
  })
})

describe('createStartingInventory', () => {
  it('seeds the bleed-counterplay bandage for a fresh run (FLO-461)', () => {
    const inv = createStartingInventory()
    expect(inv.counts[BANDAGE_ITEM_ID]).toBe(STARTING_BANDAGE_COUNT)
    expect(STARTING_BANDAGE_COUNT).toBeGreaterThan(0)
    expect(inv.equippedItemId).toBeNull()
    // Only the field kit — no stray goods.
    expect(totalItemCount(inv)).toBe(STARTING_BANDAGE_COUNT)
  })
})

describe('addItem', () => {
  it('adds a new stack and accumulates into an existing one', () => {
    let inv = addItem(createInventory(), 'gold', 5)
    expect(inv.counts.gold).toBe(5)
    inv = addItem(inv, 'gold', 3)
    expect(inv.counts.gold).toBe(8)
    expect(totalItemCount(inv)).toBe(8)
  })

  it('defaults to a quantity of one', () => {
    expect(addItem(createInventory(), 'grain').counts.grain).toBe(1)
  })

  it('floors fractional quantities', () => {
    expect(addItem(createInventory(), 'gold', 2.9).counts.gold).toBe(2)
  })

  it.each([0, -3, NaN, Infinity])('is a no-op for non-positive/non-finite quantity %s', (qty) => {
    const inv = createInventory()
    expect(addItem(inv, 'gold', qty)).toBe(inv)
  })

  it('does not mutate the input', () => {
    const inv = createInventory()
    addItem(inv, 'gold', 1)
    expect(inv.counts).toEqual({})
  })
})

describe('removeItem', () => {
  it('decrements a stack', () => {
    const inv = addItem(createInventory(), 'gold', 5)
    expect(removeItem(inv, 'gold', 2).counts.gold).toBe(3)
  })

  it('drops the stack entirely when it reaches zero', () => {
    const inv = addItem(createInventory(), 'grain', 2)
    const after = removeItem(inv, 'grain', 2)
    expect('grain' in after.counts).toBe(false)
    expect(isInventoryEmpty(after)).toBe(true)
  })

  it('clamps at zero and removes when over-removing', () => {
    const inv = addItem(createInventory(), 'gold', 1)
    expect(removeItem(inv, 'gold', 99).counts.gold).toBeUndefined()
  })

  it('is a no-op for an item not carried', () => {
    const inv = addItem(createInventory(), 'gold', 1)
    expect(removeItem(inv, 'cloth', 1)).toBe(inv)
  })

  it('unequips when the equipped stack is fully removed', () => {
    let inv = addItem(createInventory(), 'blade', 1)
    inv = equipItem(inv, 'blade')
    expect(inv.equippedItemId).toBe('blade')
    inv = removeItem(inv, 'blade', 1)
    expect(inv.equippedItemId).toBeNull()
  })
})

describe('equipItem / unequip', () => {
  it('equips a carried equippable item', () => {
    const inv = equipItem(addItem(createInventory(), 'blade', 1), 'blade')
    expect(inv.equippedItemId).toBe('blade')
  })

  it('refuses to equip a non-equippable item', () => {
    const inv = addItem(createInventory(), 'gold', 1)
    expect(equipItem(inv, 'gold')).toBe(inv)
  })

  it('refuses to equip an item not carried', () => {
    const inv = createInventory()
    expect(equipItem(inv, 'blade')).toBe(inv)
  })

  it('unequips', () => {
    const inv = equipItem(addItem(createInventory(), 'blade', 1), 'blade')
    expect(unequip(inv).equippedItemId).toBeNull()
  })

  it('unequip is a no-op when nothing is equipped', () => {
    const inv = createInventory()
    expect(unequip(inv)).toBe(inv)
  })
})

describe('listStacks', () => {
  it('returns sorted stacks with display names and equip flags', () => {
    let inv = addItem(createInventory(), 'grain', 4)
    inv = addItem(inv, 'blade', 1)
    inv = equipItem(inv, 'blade')
    expect(listStacks(inv)).toEqual([
      { itemId: 'blade', name: 'Looted Blade', count: 1, equipped: true },
      { itemId: 'grain', name: 'Grain', count: 4, equipped: false },
    ])
  })

  it('falls back to the raw id for an unknown item', () => {
    const inv = addItem(createInventory(), 'mystery', 1)
    expect(listStacks(inv)[0].name).toBe('mystery')
  })
})

describe('isInventoryState', () => {
  it('accepts a well-formed state', () => {
    expect(isInventoryState({ counts: { gold: 3 }, equippedItemId: null })).toBe(true)
    expect(isInventoryState({ counts: {}, equippedItemId: 'blade' })).toBe(true)
  })

  it.each([
    ['null', null],
    ['missing counts', { equippedItemId: null }],
    ['array counts', { counts: [], equippedItemId: null }],
    ['non-number count', { counts: { gold: 'lots' }, equippedItemId: null }],
    ['non-finite count', { counts: { gold: Infinity }, equippedItemId: null }],
    ['numeric equippedItemId', { counts: {}, equippedItemId: 7 }],
  ])('rejects %s', (_label, input) => {
    expect(isInventoryState(input)).toBe(false)
  })
})
