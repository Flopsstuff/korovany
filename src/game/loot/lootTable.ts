/**
 * Weighted loot tables with deterministic, seeded rolls (E3.3).
 *
 * Pure and engine-agnostic: given a {@link SeededRng}, {@link rollLoot} always
 * produces the same {@link LootDrop} for the same seed, so loot is reproducible
 * and unit-testable. The caravan entity rolls its table on defeat and emits the
 * drop as an event (consumed by the E3.4 inventory).
 */
import type { SeededRng } from '../util/seededRandom'

export interface LootItemDef {
  /** Stable item id used by the inventory (E3.4). */
  id: string
  /** Human-readable label. */
  label: string
  /** Relative weight for the weighted pick — higher means more likely. */
  weight: number
  /** Minimum quantity when this entry is rolled (default 1). */
  minQty?: number
  /** Maximum quantity when this entry is rolled (default 1). */
  maxQty?: number
}

export interface LootTable {
  /** How many independent weighted picks happen per defeat. */
  rolls: number
  entries: readonly LootItemDef[]
}

/** One aggregated stack of dropped items. */
export interface LootStack {
  id: string
  label: string
  qty: number
}

/** The full result of rolling a loot table once. */
export interface LootDrop {
  items: LootStack[]
}

/**
 * Default caravan haul: common coin, frequent supplies, occasional valuables,
 * and the odd bandage — the dismemberment counterplay consumable (P7.2), so a
 * player who loses a hand can find what the "find a bandage" prompt asks for.
 * Weights are relative; quantities vary so each ambush feels different while
 * staying reproducible per seed.
 */
export const DEFAULT_CARAVAN_LOOT: LootTable = {
  rolls: 3,
  entries: [
    { id: 'gold', label: 'Gold coins', weight: 50, minQty: 5, maxQty: 25 },
    { id: 'grain', label: 'Sack of grain', weight: 30, minQty: 1, maxQty: 3 },
    { id: 'bandage', label: 'Bandage', weight: 20, minQty: 1, maxQty: 2 },
    { id: 'cloth', label: 'Bolt of cloth', weight: 15, minQty: 1, maxQty: 2 },
    { id: 'blade', label: 'Looted blade', weight: 5, minQty: 1, maxQty: 1 },
  ],
}

/** Pick one entry by weight using the next value from `rng`. */
function pickWeighted(entries: readonly LootItemDef[], rng: SeededRng): LootItemDef | null {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  if (total <= 0) return null
  let r = rng.next() * total
  for (const e of entries) {
    r -= Math.max(0, e.weight)
    if (r < 0) return e
  }
  // Floating-point fallthrough — return the last positive-weight entry.
  return entries[entries.length - 1] ?? null
}

/**
 * Roll a loot table `table.rolls` times and aggregate the picks into stacks.
 * Deterministic given `rng`: the same seed yields the same drop.
 */
export function rollLoot(table: LootTable, rng: SeededRng): LootDrop {
  const byId = new Map<string, LootStack>()

  for (let i = 0; i < table.rolls; i++) {
    const entry = pickWeighted(table.entries, rng)
    if (!entry) continue
    const min = entry.minQty ?? 1
    const max = entry.maxQty ?? 1
    const qty = rng.nextInt(min, max)
    if (qty <= 0) continue

    const existing = byId.get(entry.id)
    if (existing) {
      existing.qty += qty
    } else {
      byId.set(entry.id, { id: entry.id, label: entry.label, qty })
    }
  }

  return { items: [...byId.values()] }
}
