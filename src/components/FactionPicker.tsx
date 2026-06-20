import { useState } from 'react'
import type { PlayableFactionId, PlayableFactionOption } from '../game/faction'

/** Lifecycle the picker reflects while a choice is being committed. */
export type FactionPickerStatus = 'idle' | 'loading'

export interface FactionPickerProps {
  /** Selectable factions, in display order. */
  factions: readonly PlayableFactionOption[]
  /** `loading` while the chosen game is being set up; disables interaction. */
  status?: FactionPickerStatus
  /** Commit the New Game with the chosen faction. */
  onConfirm: (id: PlayableFactionId) => void
  /** Back out to the main menu without choosing. */
  onBack: () => void
}

/**
 * New-Game faction picker (E4.2). Lists the playable factions as cards — each
 * showing its role, pitch, and asymmetric objectives — and uses a two-step
 * select→confirm affordance so a stray click never starts the wrong campaign.
 *
 * Built against the E4.2-UX requirements (purpose stated per view, plus empty /
 * loading / selected states). Visual polish tracks Iris's wireframes; this is
 * the functional first pass.
 */
export function FactionPicker({ factions, status = 'idle', onConfirm, onBack }: FactionPickerProps) {
  const [selected, setSelected] = useState<PlayableFactionId | null>(null)
  const busy = status === 'loading'
  const selectedFaction = selected ? factions.find((f) => f.id === selected) ?? null : null

  return (
    <main
      className="faction-overlay"
      role="dialog"
      aria-labelledby="faction-title"
      aria-modal="true"
    >
      <div className="faction-panel">
        <header className="faction-header">
          <p className="menu-kicker">New game</p>
          <h2 id="faction-title">Choose your faction</h2>
          <p className="faction-subtitle">
            Each faction plays toward different goals. Your choice is saved with your game.
          </p>
        </header>

        {factions.length === 0 ? (
          <p className="faction-empty">No playable factions are available yet.</p>
        ) : (
          <ul className="faction-list" aria-label="Playable factions">
            {factions.map((faction) => {
              const isSelected = faction.id === selected
              return (
                <li key={faction.id}>
                  <button
                    type="button"
                    className={`faction-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelected(faction.id)}
                    disabled={busy}
                    aria-disabled={busy}
                    aria-pressed={isSelected}
                  >
                    <span className="faction-card-name">{faction.name}</span>
                    <span className="faction-card-role">{faction.role}</span>
                    <span className="faction-card-tagline">{faction.tagline}</span>
                    <ul className="faction-card-objectives" aria-label={`${faction.name} objectives`}>
                      {faction.objectives.map((objective) => (
                        <li key={objective.id}>{objective.summary}</li>
                      ))}
                    </ul>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <footer className="faction-footer" aria-live="polite">
          {busy ? (
            <p className="faction-status">Starting…</p>
          ) : selectedFaction ? (
            <div className="faction-confirm">
              <span>Play as {selectedFaction.name}?</span>
              <button
                type="button"
                className="primary-action"
                onClick={() => onConfirm(selectedFaction.id)}
              >
                Begin
              </button>
              <button type="button" onClick={() => setSelected(null)}>
                Clear
              </button>
            </div>
          ) : (
            <p className="faction-hint">Select a faction to begin.</p>
          )}
          <button type="button" className="faction-back" onClick={onBack} disabled={busy}>
            Back
          </button>
        </footer>
      </div>
    </main>
  )
}
