import type { LootDrop as CaravanLootDrop } from '../game/loot'
import type { LootDrop as InventoryPickup } from './inventorySlice'

/**
 * Integration-edge adapter for the caravan loot loop (E3.5 — closes E3.3↔E3.4).
 *
 * The two subsystems speak different shapes on purpose, and neither public shape
 * changes (a schema is forever):
 *
 * - E3.3 caravans emit an aggregated {@link CaravanLootDrop} — `{ items: LootStack[] }`,
 *   each stack `{ id, label, qty }`.
 * - E3.4 inventory's `pickUpLoot` takes one {@link InventoryPickup} — `{ itemId, count }`.
 *
 * This maps one defeated caravan's drop into the list of `pickUpLoot` payloads
 * the live scene dispatches — one per stack. Keeping the translation here (a pure
 * function) means the wiring is unit-testable without a store or a Babylon scene,
 * and the adapter stays at the edge instead of leaking into either subsystem.
 */
export function caravanLootToPickups(drop: CaravanLootDrop): InventoryPickup[] {
  return drop.items.map((stack) => ({ itemId: stack.id, count: stack.qty }))
}
