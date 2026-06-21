/**
 * Item catalog — the static definitions of everything a player can carry.
 *
 * Inventory state persists only the **item id** and a count (see
 * {@link ./inventory}); display metadata (name, description, whether it can be
 * equipped) is resolved from this catalog at render time. Keeping the catalog as
 * the single source of metadata keeps the save payload small ("one small volume")
 * and lets us tune names/flags without touching saved data.
 *
 * Loot dropped by caravans (the "грабить корованы" loop, E3.3) references these
 * ids. Adding a new lootable good is a catalog entry here — no schema bump needed
 * because the save only stores ids + counts.
 */

/** Stable identifier for an item kind. Loot drops and inventory keys use this. */
export type ItemId = string

/** Static definition of a carriable item. */
export interface ItemDef {
  readonly id: ItemId
  /** Human-readable name shown in the HUD inventory panel. */
  readonly name: string
  /** One-line flavour/description. */
  readonly description: string
  /** Whether the item can be equipped (e.g. a weapon). */
  readonly equippable: boolean
  /**
   * Base market value, in gold pieces, of a single unit (E4.4). This is the
   * buy price at a merchant; the sell price applies a markdown (see
   * {@link ../economy/transactions}). The currency item itself ({@link gold})
   * has `value: 1` for completeness but is never bought or sold — it *is* the
   * money. A value of `0` marks a good as not tradeable.
   */
  readonly value: number
}

/**
 * The known items. Caravan loot tables (E3.3) drop these by id; the HUD reads
 * names from here. Trade goods stack; weapons are equippable.
 */
export const ITEMS = {
  gold: {
    id: 'gold',
    name: 'Gold',
    description: 'Plundered coin from a raided caravan.',
    equippable: false,
    value: 1,
  },
  grain: {
    id: 'grain',
    name: 'Grain',
    description: 'Sacks of caravan grain.',
    equippable: false,
    value: 8,
  },
  cloth: {
    id: 'cloth',
    name: 'Bolt of Cloth',
    description: 'Fine traded cloth.',
    equippable: false,
    value: 25,
  },
  blade: {
    id: 'blade',
    name: 'Looted Blade',
    description: "A caravan guard's sword — can be wielded.",
    equippable: true,
    value: 60,
  },
} as const satisfies Record<string, ItemDef>

/** Ids that exist in the catalog. Foreign/legacy ids are still valid strings. */
export type KnownItemId = keyof typeof ITEMS

/** Look up an item definition, or `undefined` for an unknown id. */
export function getItemDef(id: ItemId): ItemDef | undefined {
  return (ITEMS as Record<string, ItemDef>)[id]
}

/** Display name for an id, falling back to the raw id if unknown. */
export function itemName(id: ItemId): string {
  return getItemDef(id)?.name ?? id
}

/** Whether an id refers to an equippable item in the catalog. */
export function isEquippable(id: ItemId): boolean {
  return getItemDef(id)?.equippable ?? false
}

/**
 * Base market value (buy price) of one unit in gold pieces, or `0` for an
 * unknown / non-tradeable id. See {@link ItemDef.value}.
 */
export function itemValue(id: ItemId): number {
  return getItemDef(id)?.value ?? 0
}
