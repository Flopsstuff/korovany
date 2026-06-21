import type { SaveSlotSummary } from '../game/save'
import { onUiClick, uiHoverProps } from '../game/audio'

export interface SaveSlotsPanelProps {
  /** Fixed slot grid (empty + occupied). */
  slots: readonly SaveSlotSummary[]
  /** Resume the chosen slot. */
  onLoad: (slot: number) => void
  /** Delete the slot contents. */
  onDelete: (slot: number) => void
  /** Start a fresh run targeting this slot. */
  onNewGame: (slot: number) => void
  /** Return to the main menu landing. */
  onBack: () => void
}

/**
 * Save-slot manager (E6.5): list every slot with timestamp, zone, and summary;
 * load, delete, or start a new game into a slot.
 */
export function SaveSlotsPanel({ slots, onLoad, onDelete, onNewGame, onBack }: SaveSlotsPanelProps) {
  const anyOccupied = slots.some((s) => !s.isEmpty)

  return (
    <main className="menu-overlay" aria-labelledby="save-slots-title">
      <div className="menu-panel save-slots-panel">
        <p className="menu-kicker">Progress</p>
        <h2 id="save-slots-title">Save slots</h2>
        <p className="save-slots-intro">
          Each slot holds one campaign. Autosave writes to the slot you last loaded or started.
        </p>

        {!anyOccupied ? (
          <p className="save-slots-empty">No saves yet — pick a slot and start a new game.</p>
        ) : null}

        <ul className="save-slots-list" aria-label="Save slots">
          {slots.map((slot) => (
            <li key={slot.slot} className={slot.isEmpty ? 'save-slot save-slot--empty' : 'save-slot'}>
              <div className="save-slot-header">
                <span className="save-slot-label">
                  Slot {slot.slot + 1}
                  {slot.isLatest ? <span className="save-slot-badge">Latest</span> : null}
                </span>
                {slot.savedAt !== null ? (
                  <time className="save-slot-time" dateTime={new Date(slot.savedAt).toISOString()}>
                    {new Date(slot.savedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                ) : (
                  <span className="save-slot-time save-slot-time--empty">Empty</span>
                )}
              </div>

              {slot.isEmpty ? (
                <p className="save-slot-summary save-slot-summary--empty">No data saved in this slot.</p>
              ) : (
                <p className="save-slot-summary">{slot.summaryLine}</p>
              )}

              <div className="save-slot-actions" aria-label={`Actions for slot ${slot.slot + 1}`}>
                {!slot.isEmpty ? (
                  <>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={onUiClick(() => onLoad(slot.slot))}
                      {...uiHoverProps()}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={onUiClick(() => onDelete(slot.slot))}
                      aria-label={`Delete slot ${slot.slot + 1}`}
                      {...uiHoverProps()}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={onUiClick(() => onNewGame(slot.slot))}
                  aria-label={
                    slot.isEmpty
                      ? `New game in slot ${slot.slot + 1}`
                      : `Overwrite slot ${slot.slot + 1} with a new game`
                  }
                  {...uiHoverProps()}
                >
                  {slot.isEmpty ? 'New Game' : 'New Game (overwrite)'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="menu-actions" aria-label="Save manager navigation">
          <button type="button" onClick={onUiClick(onBack)} {...uiHoverProps()}>
            Back
          </button>
        </div>
      </div>
    </main>
  )
}
