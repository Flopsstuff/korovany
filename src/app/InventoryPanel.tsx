import { listStacks, totalItemCount, type InventoryState } from '../game/economy'

/**
 * HUD inventory panel (E3.4) — shows what the player is carrying after raiding
 * caravans (the "грабить корованы" loop). Pure presentational component driven by
 * the `inventory` slice; it renders each carried stack with its count and marks
 * the equipped item, falling back to an explicit empty state before any loot is
 * picked up.
 *
 * The panel title reads "Carried" (not "Loot") to avoid colliding with the
 * score-panel `Loot N` tally in App.tsx, which is the glanceable running count;
 * this panel is the detailed per-stack breakdown of what's currently carried.
 *
 * Visual styling lives in `src/styles/global.css` (`.hud-inventory*`), matching
 * the health HUD's translucent-overlay treatment.
 */
export function InventoryPanel({ inventory }: { inventory: InventoryState }) {
  const stacks = listStacks(inventory)
  const total = totalItemCount(inventory)

  return (
    <section
      className="hud-inventory"
      aria-label={`Inventory: ${total} ${total === 1 ? 'item' : 'items'} carried`}
    >
      <h2 className="hud-inventory-title">Carried</h2>
      {stacks.length === 0 ? (
        <p className="hud-inventory-empty">Nothing looted yet.</p>
      ) : (
        <ul className="hud-inventory-list">
          {stacks.map((stack) => (
            <li
              key={stack.itemId}
              className={`hud-inventory-item${stack.equipped ? ' is-equipped' : ''}`}
            >
              {stack.equipped ? (
                <span className="hud-inventory-equipped" aria-label="equipped">
                  ⚔
                </span>
              ) : null}
              <span className="hud-inventory-name">{stack.name}</span>
              <span className="hud-inventory-count" aria-hidden="true">
                ×{stack.count}
              </span>
              <span className="hud-inventory-sr">
                {stack.count} carried{stack.equipped ? ', equipped' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
