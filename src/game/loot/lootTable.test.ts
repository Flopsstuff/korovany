import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../util/seededRandom'
import { DEFAULT_CARAVAN_LOOT, rollLoot, type LootTable } from './lootTable'

const ids = (table: LootTable) => new Set(table.entries.map((e) => e.id))

describe('rollLoot — determinism', () => {
  it('yields the same drop for the same seed', () => {
    const a = rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(2024))
    const b = rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(2024))
    expect(a).toEqual(b)
  })

  it('yields different drops for different seeds (over a sample)', () => {
    const drops = [1, 2, 3, 4, 5].map((s) =>
      JSON.stringify(rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(s))),
    )
    // Not every pair must differ, but the set should not collapse to one.
    expect(new Set(drops).size).toBeGreaterThan(1)
  })
})

describe('default caravan loot — bandage counterplay (P7.2)', () => {
  it('includes a bandage so the dismemberment prompt references a real drop', () => {
    expect(ids(DEFAULT_CARAVAN_LOOT).has('bandage')).toBe(true)
  })

  it('drops at least one bandage across a sample of seeds', () => {
    const dropped = Array.from({ length: 200 }, (_, seed) =>
      rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(seed)),
    ).some((drop) => drop.items.some((s) => s.id === 'bandage'))
    expect(dropped).toBe(true)
  })
})

describe('rollLoot — shape & bounds', () => {
  it('only drops items that exist in the table', () => {
    const known = ids(DEFAULT_CARAVAN_LOOT)
    for (let seed = 0; seed < 200; seed++) {
      const drop = rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(seed))
      for (const stack of drop.items) expect(known.has(stack.id)).toBe(true)
    }
  })

  it('keeps per-stack quantities within the entry min/max (aggregated by rolls)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const drop = rollLoot(DEFAULT_CARAVAN_LOOT, createSeededRng(seed))
      for (const stack of drop.items) {
        const entry = DEFAULT_CARAVAN_LOOT.entries.find((e) => e.id === stack.id)!
        const max = (entry.maxQty ?? 1) * DEFAULT_CARAVAN_LOOT.rolls
        expect(stack.qty).toBeGreaterThanOrEqual(entry.minQty ?? 1)
        expect(stack.qty).toBeLessThanOrEqual(max)
      }
    }
  })

  it('aggregates repeat picks of the same id into one stack', () => {
    // A single-entry table forces every roll onto the same id → one merged stack.
    const single: LootTable = {
      rolls: 4,
      entries: [{ id: 'gold', label: 'Gold', weight: 1, minQty: 2, maxQty: 2 }],
    }
    const drop = rollLoot(single, createSeededRng(1))
    expect(drop.items).toHaveLength(1)
    expect(drop.items[0]).toEqual({ id: 'gold', label: 'Gold', qty: 8 })
  })
})

describe('rollLoot — edge cases', () => {
  it('returns no items when the table has no rolls', () => {
    const drop = rollLoot({ rolls: 0, entries: DEFAULT_CARAVAN_LOOT.entries }, createSeededRng(1))
    expect(drop.items).toEqual([])
  })

  it('returns no items when all weights are zero', () => {
    const drop = rollLoot(
      { rolls: 3, entries: [{ id: 'x', label: 'X', weight: 0 }] },
      createSeededRng(1),
    )
    expect(drop.items).toEqual([])
  })

  it('respects relative weight: a heavily-weighted id dominates', () => {
    const table: LootTable = {
      rolls: 1,
      entries: [
        { id: 'common', label: 'Common', weight: 99 },
        { id: 'rare', label: 'Rare', weight: 1 },
      ],
    }
    let common = 0
    for (let seed = 0; seed < 500; seed++) {
      const drop = rollLoot(table, createSeededRng(seed))
      if (drop.items[0]?.id === 'common') common++
    }
    expect(common).toBeGreaterThan(400) // ~99% expected
  })
})
