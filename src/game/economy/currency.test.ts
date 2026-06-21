import { describe, expect, it } from 'vitest'
import { CURRENCY_ITEM_ID, canAfford, credit, debit, getBalance } from './currency'
import { addItem, createInventory } from './inventory'

describe('currency', () => {
  it('the currency item is gold', () => {
    expect(CURRENCY_ITEM_ID).toBe('gold')
  })

  it('getBalance reads the gold stack, defaulting to 0', () => {
    expect(getBalance(createInventory())).toBe(0)
    expect(getBalance(addItem(createInventory(), 'gold', 17))).toBe(17)
    // other goods don't count as money
    expect(getBalance(addItem(createInventory(), 'grain', 5))).toBe(0)
  })

  it('credit adds gold and is a no-op for non-positive amounts', () => {
    let inv = credit(createInventory(), 10)
    expect(getBalance(inv)).toBe(10)
    inv = credit(inv, 5)
    expect(getBalance(inv)).toBe(15)
    expect(getBalance(credit(inv, 0))).toBe(15)
    expect(getBalance(credit(inv, -4))).toBe(15)
    expect(getBalance(credit(inv, Number.NaN))).toBe(15)
  })

  it('debit removes gold, clamping at zero and dropping an empty stack', () => {
    const inv = credit(createInventory(), 20)
    expect(getBalance(debit(inv, 8))).toBe(12)
    const drained = debit(inv, 20)
    expect(getBalance(drained)).toBe(0)
    expect('gold' in drained.counts).toBe(false)
    // never goes negative
    expect(getBalance(debit(inv, 999))).toBe(0)
  })

  it('canAfford compares against the balance; non-positive costs are free', () => {
    const inv = credit(createInventory(), 30)
    expect(canAfford(inv, 30)).toBe(true)
    expect(canAfford(inv, 31)).toBe(false)
    expect(canAfford(inv, 0)).toBe(true)
    expect(canAfford(createInventory(), 0)).toBe(true)
    expect(canAfford(createInventory(), 1)).toBe(false)
  })

  it('does not mutate the input inventory', () => {
    const inv = createInventory()
    credit(inv, 5)
    expect(inv).toEqual({ counts: {}, equippedItemId: null })
  })
})
