/**
 * Buy/sell transactions (E4.4) — the economy core.
 *
 * Pure, engine-agnostic logic layered on the inventory model: a transaction
 * takes the current {@link InventoryState} and returns a *result* — either a new
 * inventory with the goods + gold moved, or a typed failure reason. Nothing
 * mutates the input. The Redux seam ({@link ../../store/inventorySlice}) applies
 * the new inventory on success and no-ops on failure; the shop UI (a separate
 * Iris-gated ticket) can call these directly to validate before dispatching and
 * to surface the failure reason to the player.
 *
 * Pricing is Daggerfall-flavoured: an item's catalog {@link itemValue} is the
 * buy price, and merchants buy goods back at a markdown ({@link SELL_RATE}). The
 * currency itself ({@link CURRENCY_ITEM_ID}) can never be bought or sold — it is
 * the money.
 */

import { CURRENCY_ITEM_ID, canAfford, credit, debit, getBalance } from './currency'
import { addItem, removeItem, type InventoryState } from './inventory'
import { getItemDef, itemValue, type ItemId } from './items'

/**
 * Fraction of an item's base value a merchant pays when buying it back from the
 * player. Sell prices floor to whole gold pieces, never below 1 for a tradeable
 * good worth anything.
 */
export const SELL_RATE = 0.5

/** Why a transaction could not be completed. */
export type TransactionFailureReason =
  | 'invalid-quantity'
  | 'unknown-item'
  | 'not-tradeable'
  | 'insufficient-funds'
  | 'insufficient-stock'

/** A completed buy or sell. */
export interface TransactionSuccess {
  readonly ok: true
  /** The inventory after the trade (goods + gold moved). */
  readonly inventory: InventoryState
  /** Total gold that changed hands (paid on a buy, received on a sell). */
  readonly total: number
  /** Gold balance after the trade. */
  readonly balance: number
}

/** A rejected buy or sell; the input inventory is unchanged. */
export interface TransactionFailure {
  readonly ok: false
  readonly reason: TransactionFailureReason
}

export type TransactionResult = TransactionSuccess | TransactionFailure

function normaliseQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0
  return Math.max(0, Math.floor(quantity))
}

/** Whether an item id can be traded (known, priced, and not the currency). */
export function isTradeable(itemId: ItemId): boolean {
  if (itemId === CURRENCY_ITEM_ID) return false
  return itemValue(itemId) > 0
}

/** Buy price for `quantity` units of `itemId` (base value × quantity). */
export function buyPrice(itemId: ItemId, quantity = 1): number {
  return itemValue(itemId) * normaliseQuantity(quantity)
}

/** Unit sell price: the base value marked down by {@link SELL_RATE}, min 1. */
export function unitSellPrice(itemId: ItemId): number {
  const base = itemValue(itemId)
  if (base <= 0) return 0
  return Math.max(1, Math.floor(base * SELL_RATE))
}

/** Sell price for `quantity` units of `itemId`. */
export function sellPrice(itemId: ItemId, quantity = 1): number {
  return unitSellPrice(itemId) * normaliseQuantity(quantity)
}

function fail(reason: TransactionFailureReason): TransactionFailure {
  return { ok: false, reason }
}

/**
 * Buy `quantity` (default 1) units of `itemId` from a merchant: debit the gold
 * cost and add the goods to the inventory. Fails without touching state when the
 * quantity is non-positive, the item is unknown / not tradeable, or the player
 * cannot afford the total.
 */
export function buy(inv: InventoryState, itemId: ItemId, quantity = 1): TransactionResult {
  const qty = normaliseQuantity(quantity)
  if (qty === 0) return fail('invalid-quantity')
  if (!getItemDef(itemId)) return fail('unknown-item')
  if (!isTradeable(itemId)) return fail('not-tradeable')
  const total = buyPrice(itemId, qty)
  if (!canAfford(inv, total)) return fail('insufficient-funds')
  const inventory = addItem(debit(inv, total), itemId, qty)
  return { ok: true, inventory, total, balance: getBalance(inventory) }
}

/**
 * Sell `quantity` (default 1) units of `itemId` to a merchant: remove the goods
 * and credit the marked-down gold. Fails without touching state when the
 * quantity is non-positive, the item is unknown / not tradeable, or the player
 * does not carry enough of it.
 */
export function sell(inv: InventoryState, itemId: ItemId, quantity = 1): TransactionResult {
  const qty = normaliseQuantity(quantity)
  if (qty === 0) return fail('invalid-quantity')
  if (!getItemDef(itemId)) return fail('unknown-item')
  if (!isTradeable(itemId)) return fail('not-tradeable')
  if ((inv.counts[itemId] ?? 0) < qty) return fail('insufficient-stock')
  const total = sellPrice(itemId, qty)
  const inventory = credit(removeItem(inv, itemId, qty), total)
  return { ok: true, inventory, total, balance: getBalance(inventory) }
}
