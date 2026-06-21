import { describe, expect, it } from 'vitest'
import { credit, getBalance } from './currency'
import { addItem, createInventory } from './inventory'
import { itemValue } from './items'
import {
  SELL_RATE,
  buy,
  buyPrice,
  isTradeable,
  sell,
  sellPrice,
  unitSellPrice,
} from './transactions'

describe('pricing helpers', () => {
  it('isTradeable excludes the currency and unknown/zero-value goods', () => {
    expect(isTradeable('grain')).toBe(true)
    expect(isTradeable('blade')).toBe(true)
    expect(isTradeable('gold')).toBe(false) // currency is never traded
    expect(isTradeable('nonsense')).toBe(false)
  })

  it('buyPrice is base value × quantity', () => {
    expect(buyPrice('grain')).toBe(itemValue('grain'))
    expect(buyPrice('cloth', 3)).toBe(itemValue('cloth') * 3)
    expect(buyPrice('grain', 0)).toBe(0)
    expect(buyPrice('grain', -2)).toBe(0)
  })

  it('sell price applies the markdown and floors to >= 1', () => {
    expect(unitSellPrice('cloth')).toBe(Math.floor(itemValue('cloth') * SELL_RATE))
    expect(sellPrice('blade', 2)).toBe(unitSellPrice('blade') * 2)
    // a tradeable good never sells for 0 gold
    expect(unitSellPrice('grain')).toBeGreaterThanOrEqual(1)
    // unknown / zero-value goods have no sell price (the currency is gated by
    // isTradeable in sell(), not by the price helper)
    expect(unitSellPrice('nonsense')).toBe(0)
  })
})

describe('buy', () => {
  it('debits gold and adds the goods on success', () => {
    const inv = credit(createInventory(), 100)
    const result = buy(inv, 'cloth', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const cost = buyPrice('cloth', 2)
    expect(result.total).toBe(cost)
    expect(result.balance).toBe(100 - cost)
    expect(result.inventory.counts.cloth).toBe(2)
    expect(getBalance(result.inventory)).toBe(100 - cost)
  })

  it('rejects when the player cannot afford it (state untouched)', () => {
    const inv = credit(createInventory(), 5)
    const result = buy(inv, 'blade', 1) // blade costs 60
    expect(result).toEqual({ ok: false, reason: 'insufficient-funds' })
  })

  it('rejects unknown items, the currency itself, and bad quantities', () => {
    const inv = credit(createInventory(), 1000)
    expect(buy(inv, 'nonsense', 1)).toEqual({ ok: false, reason: 'unknown-item' })
    expect(buy(inv, 'gold', 1)).toEqual({ ok: false, reason: 'not-tradeable' })
    expect(buy(inv, 'grain', 0)).toEqual({ ok: false, reason: 'invalid-quantity' })
    expect(buy(inv, 'grain', -1)).toEqual({ ok: false, reason: 'invalid-quantity' })
  })

  it('does not mutate the input inventory', () => {
    const inv = credit(createInventory(), 100)
    buy(inv, 'cloth', 1)
    expect(getBalance(inv)).toBe(100)
    expect('cloth' in inv.counts).toBe(false)
  })
})

describe('sell', () => {
  it('removes the goods and credits the marked-down gold', () => {
    const inv = addItem(createInventory(), 'cloth', 3)
    const result = sell(inv, 'cloth', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.total).toBe(sellPrice('cloth', 2))
    expect(result.inventory.counts.cloth).toBe(1)
    expect(getBalance(result.inventory)).toBe(sellPrice('cloth', 2))
    expect(result.balance).toBe(sellPrice('cloth', 2))
  })

  it('rejects selling more than is carried (state untouched)', () => {
    const inv = addItem(createInventory(), 'grain', 1)
    expect(sell(inv, 'grain', 2)).toEqual({ ok: false, reason: 'insufficient-stock' })
    expect(sell(createInventory(), 'grain', 1)).toEqual({
      ok: false,
      reason: 'insufficient-stock',
    })
  })

  it('rejects the currency, unknown items, and bad quantities', () => {
    const inv = addItem(addItem(createInventory(), 'gold', 50), 'grain', 5)
    expect(sell(inv, 'gold', 1)).toEqual({ ok: false, reason: 'not-tradeable' })
    expect(sell(inv, 'nonsense', 1)).toEqual({ ok: false, reason: 'unknown-item' })
    expect(sell(inv, 'grain', 0)).toEqual({ ok: false, reason: 'invalid-quantity' })
  })

  it('buy then sell round-trips at a loss equal to the markdown', () => {
    const start = credit(createInventory(), 100)
    const bought = buy(start, 'cloth', 1)
    expect(bought.ok).toBe(true)
    if (!bought.ok) return
    const sold = sell(bought.inventory, 'cloth', 1)
    expect(sold.ok).toBe(true)
    if (!sold.ok) return
    // back to no cloth, gold reduced by (buy - sell) markdown
    expect('cloth' in sold.inventory.counts).toBe(false)
    expect(getBalance(sold.inventory)).toBe(100 - buyPrice('cloth') + sellPrice('cloth'))
    expect(getBalance(sold.inventory)).toBeLessThan(100)
  })
})
