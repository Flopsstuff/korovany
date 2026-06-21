# Economy

E4.4 adds the economy core: a **currency** and pure **buy/sell transactions**
layered on the existing inventory model (E3.4). This is the transaction logic
only — the merchant / shop UI is a separate, Iris-gated ticket. All of it is
pure, engine-agnostic game code in `src/game/economy/` with a thin Redux seam in
`src/store/inventorySlice.ts`.

## Currency is the carried `gold`

Money is **gold pieces**, and gold is already a carried good: caravan loot tables
(E3.3) drop the `gold` item straight into the player's inventory (E3.4). So the
currency *is* the `gold` stack in the inventory rather than a separate wallet
scalar — looted coin is spendable coin, and there is no second balance to keep in
sync. As a consequence this ticket needs **no save-schema bump**: the gold
balance already persists as part of the inventory snapshot.

`src/game/economy/currency.ts` is the named seam over that balance:

- `CURRENCY_ITEM_ID` — the item id that doubles as money (`'gold'`).
- `getBalance(inv)` — current spendable gold (the `gold` stack count, or `0`).
- `canAfford(inv, amount)` — whether the balance covers `amount`.
- `credit(inv, amount)` / `debit(inv, amount)` — add / remove gold, returning
  fresh state. `debit` clamps at zero (never overdraws); both ignore
  non-positive / non-finite amounts.

Callers should use these instead of reaching into `counts.gold` by hand.

## Pricing

Each item in the catalog (`src/game/economy/items.ts`) carries a base market
`value` in gold pieces — the **buy price** of one unit. Merchants buy goods back
at a markdown (`SELL_RATE`, currently `0.5`), floored to whole gold and never
below `1` for a good worth anything. A `value` of `0` marks a good as not
tradeable.

| Item | Value (buy) | Sell (×0.5) |
| --- | --- | --- |
| Gold (currency) | 1 | — (never traded) |
| Grain | 8 | 4 |
| Bolt of Cloth | 25 | 12 |
| Looted Blade | 60 | 30 |

Price helpers in `src/game/economy/transactions.ts`: `itemValue(id)`,
`buyPrice(id, qty)`, `unitSellPrice(id)`, `sellPrice(id, qty)`, and
`isTradeable(id)` (false for the currency and for unknown / zero-value goods).

## Transactions

`buy` and `sell` are pure functions over the inventory; nothing mutates the
input. Each returns a discriminated result:

```ts
const result = buy(inventory, 'cloth', 2)
if (result.ok) {
  result.inventory // new state: gold debited, goods added
  result.total     // gold that changed hands
  result.balance   // gold balance after the trade
} else {
  result.reason // why it failed (see below)
}
```

- `buy(inv, itemId, qty=1)` — debits the gold cost and adds the goods.
- `sell(inv, itemId, qty=1)` — removes the goods and credits the marked-down gold.

Failure reasons (`TransactionFailureReason`), returned without touching state:

| Reason | When |
| --- | --- |
| `invalid-quantity` | quantity is zero or negative |
| `unknown-item` | the id is not in the catalog |
| `not-tradeable` | the id is the currency or a zero-value good |
| `insufficient-funds` | buy: balance does not cover the total |
| `insufficient-stock` | sell: the player does not carry that many |

A buy → sell round-trip returns the goods to the merchant at a loss equal to the
markdown — there is no money pump.

## Store bridge

`src/store/inventorySlice.ts` exposes the economy on the existing inventory
slice (currency lives there, so trades stay inside one state):

- `buyItem({ itemId, quantity? })` — applies `buy`; **no-op** if the trade fails.
- `sellItem({ itemId, quantity? })` — applies `sell`; **no-op** if the trade fails.
- `selectGold(state)` — current gold balance.
- `selectInventory(state)` — the whole inventory state.

The reducers no-op on failure (like the other inventory ops). The shop UI ticket
can call the pure `buy` / `sell` directly to validate and surface the failure
reason to the player *before* dispatching, and can dispatch `recordPurchase`
(see [character-progression.md](character-progression.md)) to award trade-skill
XP on a successful buy.
