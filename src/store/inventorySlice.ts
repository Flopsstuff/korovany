import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  addItem,
  buy,
  createInventory,
  equipItem,
  getBalance,
  removeItem,
  sell,
  unequip,
  type InventoryState,
  type ItemId,
} from '../game/economy'

/**
 * Inventory slice — the shared-state wrapper around the pure inventory model in
 * `src/game/economy`. Reducers delegate to the pure ops and return the fresh
 * state they produce, so all the carry/equip rules live in one tested place.
 *
 * `pickUpLoot` is the integration seam for caravan loot drops (E3.3): the ambush
 * loop dispatches it with the item id + count a defeated caravan dropped.
 * `buyItem` / `sellItem` are the economy seam (E4.4): currency is the carried
 * `gold` stack, so trades move goods + gold inside this one inventory state; a
 * trade that fails (unaffordable, out of stock, not tradeable) is a no-op here,
 * and the shop UI (separate ticket) can call the pure `buy`/`sell` to surface
 * the failure reason before dispatching.
 * `restoreInventory` overwrites state from a loaded save (Continue).
 */

/** Loot handed to the inventory when a player picks up a caravan drop. */
export interface LootDrop {
  readonly itemId: ItemId
  readonly count: number
}

/** A buy/sell request: how many units of which item to trade (default 1). */
export interface TradeRequest {
  readonly itemId: ItemId
  readonly quantity?: number
}

const initialState: InventoryState = createInventory()

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    /** Collect a caravan loot drop (E3.3) into the inventory. */
    pickUpLoot(state, action: PayloadAction<LootDrop>) {
      return addItem(state, action.payload.itemId, action.payload.count)
    },
    /** Drop / consume `count` (default 1) of an item. */
    dropItem(state, action: PayloadAction<{ itemId: ItemId; count?: number }>) {
      return removeItem(state, action.payload.itemId, action.payload.count ?? 1)
    },
    /** Equip a carried equippable item. */
    equip(state, action: PayloadAction<ItemId>) {
      return equipItem(state, action.payload)
    },
    /** Clear the equipped slot. */
    unequipItem(state) {
      return unequip(state)
    },
    /** Buy goods from a merchant (E4.4); no-op if unaffordable / not tradeable. */
    buyItem(state, action: PayloadAction<TradeRequest>) {
      const result = buy(state, action.payload.itemId, action.payload.quantity ?? 1)
      return result.ok ? result.inventory : state
    },
    /** Sell goods to a merchant (E4.4); no-op if not carried / not tradeable. */
    sellItem(state, action: PayloadAction<TradeRequest>) {
      const result = sell(state, action.payload.itemId, action.payload.quantity ?? 1)
      return result.ok ? result.inventory : state
    },
    /** Reset to an empty inventory (New Game). */
    resetInventory() {
      return createInventory()
    },
    /** Overwrite inventory from a loaded save (Continue). */
    restoreInventory(_state, action: PayloadAction<InventoryState>) {
      return {
        counts: { ...action.payload.counts },
        equippedItemId: action.payload.equippedItemId,
      }
    },
  },
})

export const {
  pickUpLoot,
  dropItem,
  equip,
  unequipItem,
  buyItem,
  sellItem,
  resetInventory,
  restoreInventory,
} = inventorySlice.actions
export const inventoryReducer = inventorySlice.reducer

/** The whole inventory state. */
export const selectInventory = (state: { inventory: InventoryState }): InventoryState =>
  state.inventory

/** Current spendable gold balance (E4.4) — the carried `gold` stack count. */
export const selectGold = (state: { inventory: InventoryState }): number =>
  getBalance(state.inventory)
