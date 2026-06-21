/**
 * Economy systems barrel — inventory model, item catalog, currency, and
 * buy/sell transactions (E4.4).
 *
 * Pure, engine-agnostic game logic (no React, no Babylon). The Redux integration
 * lives in `src/store/inventorySlice.ts`; persistence in `src/game/save`.
 */

export {
  ITEMS,
  BANDAGE_ITEM_ID,
  getItemDef,
  itemName,
  isEquippable,
  itemValue,
  type ItemDef,
  type ItemId,
  type KnownItemId,
} from './items'

export { CURRENCY_ITEM_ID, getBalance, canAfford, credit, debit } from './currency'

export {
  SELL_RATE,
  isTradeable,
  buyPrice,
  unitSellPrice,
  sellPrice,
  buy,
  sell,
  type TransactionResult,
  type TransactionSuccess,
  type TransactionFailure,
  type TransactionFailureReason,
} from './transactions'

export {
  createInventory,
  addItem,
  removeItem,
  equipItem,
  unequip,
  listStacks,
  totalItemCount,
  isInventoryEmpty,
  isInventoryState,
  type InventoryState,
  type InventoryStack,
} from './inventory'
