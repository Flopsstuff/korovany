/**
 * Inventory model — engine-agnostic, pure, and serialisable.
 *
 * The state is a flat `itemId → count` map plus a single optional `equippedItemId`.
 * Every operation is a pure function returning fresh state (never mutating the
 * input), which keeps it trivial to use from a Redux reducer and to snapshot into
 * the save payload. The shape is deliberately plain JSON so it round-trips through
 * IndexedDB unchanged — see `src/game/save` and its versioned migration.
 *
 * Items resolve their display metadata from the catalog in {@link ./items}; the
 * inventory itself stores only ids + counts.
 */

import { BANDAGE_ITEM_ID, getItemDef, itemName, type ItemId } from './items'

/**
 * Carried inventory. `counts` holds positive integer quantities keyed by item id
 * (a zero/empty stack is removed, never stored as `0`). `equippedItemId` is the
 * currently equipped item, or `null` when nothing is equipped.
 */
export interface InventoryState {
  readonly counts: Readonly<Record<ItemId, number>>
  readonly equippedItemId: ItemId | null
}

/** A single carried stack, denormalised with display metadata for the HUD. */
export interface InventoryStack {
  readonly itemId: ItemId
  readonly name: string
  readonly count: number
  readonly equipped: boolean
}

/** A fresh, empty inventory. */
export function createInventory(): InventoryState {
  return { counts: {}, equippedItemId: null }
}

/**
 * Number of bandages a fresh run starts with (FLO-461). One field dressing makes
 * the dismemberment bleed counterplay (P7.2) reachable in the very first session,
 * before the player has found any loot — without it a first-session wound bled
 * out with no recourse (FLO-453 audit finding).
 */
export const STARTING_BANDAGE_COUNT = 1

/**
 * Inventory a new game starts with: the empty inventory plus the starting field
 * kit (a bandage). Loaded saves restore their own inventory via `restoreInventory`
 * and are unaffected by this loadout.
 */
export function createStartingInventory(): InventoryState {
  return addItem(createInventory(), BANDAGE_ITEM_ID, STARTING_BANDAGE_COUNT)
}

function normaliseQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0
  return Math.max(0, Math.floor(quantity))
}

/**
 * Add `quantity` (default 1) of an item to the inventory. Non-positive or
 * non-finite quantities are a no-op (the same state is returned).
 */
export function addItem(inv: InventoryState, itemId: ItemId, quantity = 1): InventoryState {
  const qty = normaliseQuantity(quantity)
  if (qty === 0) return inv
  const current = inv.counts[itemId] ?? 0
  return { ...inv, counts: { ...inv.counts, [itemId]: current + qty } }
}

/**
 * Remove `quantity` (default 1) of an item. Counts clamp at zero; a stack that
 * reaches zero is dropped from the map, and if that item was equipped it is
 * unequipped. Removing an item the player does not carry is a no-op.
 */
export function removeItem(inv: InventoryState, itemId: ItemId, quantity = 1): InventoryState {
  const qty = normaliseQuantity(quantity)
  const current = inv.counts[itemId] ?? 0
  if (qty === 0 || current === 0) return inv
  const next = Math.max(0, current - qty)
  const counts = { ...inv.counts }
  let equippedItemId = inv.equippedItemId
  if (next === 0) {
    delete counts[itemId]
    if (equippedItemId === itemId) equippedItemId = null
  } else {
    counts[itemId] = next
  }
  return { counts, equippedItemId }
}

/**
 * Equip an item. Only succeeds if the item is carried and the catalog marks it
 * equippable; otherwise the state is unchanged.
 */
export function equipItem(inv: InventoryState, itemId: ItemId): InventoryState {
  if (!getItemDef(itemId)?.equippable) return inv
  if ((inv.counts[itemId] ?? 0) <= 0) return inv
  if (inv.equippedItemId === itemId) return inv
  return { ...inv, equippedItemId: itemId }
}

/** Clear the equipped slot. No-op when nothing is equipped. */
export function unequip(inv: InventoryState): InventoryState {
  if (inv.equippedItemId === null) return inv
  return { ...inv, equippedItemId: null }
}

/** Carried stacks with display metadata, sorted by item id for stable rendering. */
export function listStacks(inv: InventoryState): InventoryStack[] {
  return Object.keys(inv.counts)
    .sort()
    .map((itemId) => ({
      itemId,
      name: itemName(itemId),
      count: inv.counts[itemId],
      equipped: inv.equippedItemId === itemId,
    }))
}

/** Total number of items carried across all stacks. */
export function totalItemCount(inv: InventoryState): number {
  return Object.values(inv.counts).reduce((sum, n) => sum + n, 0)
}

/** Whether the inventory holds no items. */
export function isInventoryEmpty(inv: InventoryState): boolean {
  return Object.keys(inv.counts).length === 0
}

/**
 * Structural guard for an {@link InventoryState} read back from an untrusted blob
 * (a save record). Accepts a plain `counts` map of finite numbers and an
 * `equippedItemId` that is a string or `null`.
 */
export function isInventoryState(value: unknown): value is InventoryState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.equippedItemId !== null && typeof v.equippedItemId !== 'string') return false
  const counts = v.counts
  if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) return false
  return Object.values(counts as Record<string, unknown>).every(
    (n) => typeof n === 'number' && Number.isFinite(n),
  )
}
