/**
 * Currency model (E4.4).
 *
 * Korovany's money is **gold pieces**, and gold is already a carried item: the
 * caravan loot tables (E3.3) drop the `gold` good straight into the player's
 * inventory (E3.4). Rather than introduce a parallel wallet scalar — which would
 * orphan looted coin from spendable coin — the currency *is* the `gold` stack in
 * the {@link InventoryState}. These helpers are the single, named seam for
 * reading and moving that balance, so buy/sell transactions and the (separate)
 * shop UI never reach into `counts.gold` by hand.
 *
 * Every helper is pure and returns fresh state, mirroring the inventory model.
 */

import { addItem, removeItem, type InventoryState } from './inventory'
import type { ItemId } from './items'

/** The inventory item id that doubles as the currency. */
export const CURRENCY_ITEM_ID: ItemId = 'gold'

function clampAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.max(0, Math.floor(amount))
}

/** Current spendable gold balance (the `gold` stack count), or `0`. */
export function getBalance(inv: InventoryState): number {
  return inv.counts[CURRENCY_ITEM_ID] ?? 0
}

/** Whether the player can afford `amount` gold. Non-positive amounts are free. */
export function canAfford(inv: InventoryState, amount: number): boolean {
  return getBalance(inv) >= clampAmount(amount)
}

/**
 * Add `amount` gold to the balance. Non-positive / non-finite amounts are a
 * no-op (the same state is returned).
 */
export function credit(inv: InventoryState, amount: number): InventoryState {
  return addItem(inv, CURRENCY_ITEM_ID, clampAmount(amount))
}

/**
 * Remove `amount` gold from the balance, clamped at zero. Callers that must not
 * overdraw should gate on {@link canAfford} first; this mirrors `removeItem` and
 * never goes negative.
 */
export function debit(inv: InventoryState, amount: number): InventoryState {
  return removeItem(inv, CURRENCY_ITEM_ID, clampAmount(amount))
}
