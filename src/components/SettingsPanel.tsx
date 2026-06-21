import type { RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { AudioControls } from '../app/AudioControls'
import { onUiClick, uiHoverProps } from '../game/audio'
import type { InputAction } from '../game/input/intent'
import { defaultBindings } from '../game/input/bindings'
import {
  ACTION_LABELS,
  formatKeyCode,
  FORBIDDEN_BINDING_CODES,
  settingsStore,
  type GraphicsQuality,
} from '../game/settings'

const INPUT_ACTIONS = Object.keys(defaultBindings) as InputAction[]

export interface SettingsPanelProps {
  onClose: () => void
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

/**
 * Settings & accessibility panel (E6.4): rebindable controls, master volume,
 * and graphics quality. Reachable from the main menu and pause overlay.
 */
export function SettingsPanel({ onClose, closeButtonRef }: SettingsPanelProps) {
  const [bindings, setBindings] = useState(() => settingsStore.getKeyBindings())
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() =>
    settingsStore.getGraphicsQuality(),
  )
  const [rebindingAction, setRebindingAction] = useState<InputAction | null>(null)
  const [rebindError, setRebindError] = useState<string | null>(null)

  useEffect(() => {
    return settingsStore.subscribe((snapshot) => {
      setBindings(snapshot.keyBindings)
      setGraphicsQuality(snapshot.graphicsQuality)
    })
  }, [])

  const startRebind = useCallback((action: InputAction) => {
    setRebindError(null)
    setRebindingAction(action)
  }, [])

  const cancelRebind = useCallback(() => {
    setRebindingAction(null)
    setRebindError(null)
  }, [])

  useEffect(() => {
    if (!rebindingAction) return

    function onKeyDown(event: KeyboardEvent): void {
      event.preventDefault()
      event.stopPropagation()
      if (event.code === 'Escape') {
        cancelRebind()
        return
      }
      if (FORBIDDEN_BINDING_CODES.has(event.code)) {
        setRebindError('That key is reserved — choose another.')
        return
      }
      settingsStore.setKeyBinding(rebindingAction!, event.code)
      setRebindingAction(null)
      setRebindError(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [rebindingAction, cancelRebind])

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-labelledby="settings-title"
      aria-modal="true"
    >
      <div className="settings-panel menu-panel">
        <p className="menu-kicker">Preferences</p>
        <h2 id="settings-title">Settings</h2>

        <section className="settings-section" aria-labelledby="settings-controls-heading">
          <h3 id="settings-controls-heading">Controls</h3>
          {rebindError ? (
            <p className="settings-error" role="alert">
              {rebindError}
            </p>
          ) : null}
          <ul className="settings-bindings">
            {INPUT_ACTIONS.map((action) => {
              const code = bindings[action]
              const isActive = rebindingAction === action
              return (
                <li key={action}>
                  <span className="settings-binding-label">{ACTION_LABELS[action]}</span>
                  <kbd className="settings-binding-key">{formatKeyCode(code)}</kbd>
                  <button
                    type="button"
                    className="settings-rebind-btn"
                    aria-pressed={isActive}
                    onClick={onUiClick(() => (isActive ? cancelRebind() : startRebind(action)))}
                    {...uiHoverProps()}
                  >
                    {isActive ? 'Cancel' : 'Rebind'}
                  </button>
                </li>
              )
            })}
          </ul>
          {rebindingAction ? (
            <p className="settings-hint" role="status">
              Press a key for <strong>{ACTION_LABELS[rebindingAction]}</strong> —{' '}
              <kbd>Esc</kbd> to cancel.
            </p>
          ) : null}
          <button
            type="button"
            className="settings-reset-btn"
            onClick={onUiClick(() => {
              settingsStore.resetKeyBindings()
              cancelRebind()
            })}
            {...uiHoverProps()}
          >
            Reset controls to defaults
          </button>
        </section>

        <section className="settings-section" aria-labelledby="settings-audio-heading">
          <h3 id="settings-audio-heading">Audio</h3>
          <AudioControls />
        </section>

        <section className="settings-section" aria-labelledby="settings-graphics-heading">
          <h3 id="settings-graphics-heading">Graphics</h3>
          <fieldset className="settings-quality">
            <legend className="visually-hidden">Graphics quality</legend>
            <label className="settings-quality-option" {...uiHoverProps()}>
              <input
                type="radio"
                name="graphics-quality"
                value="low"
                checked={graphicsQuality === 'low'}
                onChange={() => settingsStore.setGraphicsQuality('low')}
              />
              Low
            </label>
            <label className="settings-quality-option" {...uiHoverProps()}>
              <input
                type="radio"
                name="graphics-quality"
                value="high"
                checked={graphicsQuality === 'high'}
                onChange={() => settingsStore.setGraphicsQuality('high')}
              />
              High
            </label>
          </fieldset>
          <p className="settings-hint">
            Quality preference is saved now; perf/streaming will honour it in a later pass.
          </p>
        </section>

        <div className="menu-actions" aria-label="Settings actions">
          <button
            ref={closeButtonRef}
            type="button"
            className="primary-action"
            onClick={onClose}
            {...uiHoverProps()}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
