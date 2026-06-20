import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import { hasSave, loadLatest, saveGame } from '../game/save'
import {
  applyPlayerTransform,
  readPlayerTransform,
  stageSpawn,
} from '../game/save/playerRuntime'
import {
  continueGame,
  resetInjuries,
  resetPlayer,
  resetPlayerHealth,
  restorePlayer,
  restorePlayerHealth,
  returnToMenu,
  selectIsBleeding,
  selectIsStreamingLoading,
  startNewGame,
  tickInjuries,
  togglePause,
  useAppDispatch,
  useAppSelector,
} from '../store'

/**
 * App shell: a full-viewport stage holding the 3D canvas with React overlays
 * above it. The app state machine owns coarse flow while Babylon remains
 * isolated behind GameCanvas.
 *
 * It also owns the save/load wiring (E1.4): autosave whenever the game enters
 * `paused`, and a **Continue** button that restores the latest save. The live
 * capsule transform crosses the React↔Babylon boundary only through the save
 * `playerRuntime` bridge — never a direct mesh reference. Health is sourced from
 * the canonical `healthSlice`; the zone id from `playerSlice`.
 *
 * See `src/styles/global.css` for the no-scroll, full-page reset and the
 * `.app-shell` / overlay layering.
 */
export function App() {
  const dispatch = useAppDispatch()
  const phase = useAppSelector((state) => state.app.phase)
  const health = useAppSelector((state) => state.health.player)
  const zoneId = useAppSelector((state) => state.player.zoneId)
  const isLoadingAssets = useAppSelector(selectIsStreamingLoading)
  const isBleeding = useAppSelector(selectIsBleeding)
  const menuPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const pausePrimaryActionRef = useRef<HTMLButtonElement>(null)

  const [hasSaveSlot, setHasSaveSlot] = useState(false)

  // Return to menu on player death; reset HP and injuries so a subsequent New
  // Game starts fresh.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return
    if (health.current > 0) return
    dispatch(resetPlayerHealth())
    dispatch(resetInjuries())
    dispatch(returnToMenu())
  }, [health.current, phase, dispatch])

  // Bleed-out: while a wound is untreated and the game is live, drain HP each
  // second. tickInjuries funnels the damage into the health system, so an
  // untreated bleed reaches 0 HP and triggers the death effect above.
  useEffect(() => {
    if (phase !== 'playing') return
    if (!isBleeding) return
    const id = window.setInterval(() => dispatch(tickInjuries(1)), 1000)
    return () => window.clearInterval(id)
  }, [isBleeding, phase, dispatch])

  // Latest player scalars, read at autosave time without re-arming the pause
  // effect every time health/zone change.
  const snapshotRef = useRef({ health, zoneId })
  snapshotRef.current = { health, zoneId }

  // Probe whether a save exists so the Continue button can render enabled/empty.
  useEffect(() => {
    let active = true
    void hasSave()
      .then((exists) => {
        if (active) setHasSaveSlot(exists)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (phase === 'menu') menuPrimaryActionRef.current?.focus()
    else if (phase === 'paused') pausePrimaryActionRef.current?.focus()
  }, [phase])

  // Autosave on the transition into `paused`. The transform comes from the live
  // scene via the bridge; health from `healthSlice`, zone from `playerSlice`. No
  // scene mounted → skip.
  useEffect(() => {
    if (phase !== 'paused') return
    const transform = readPlayerTransform()
    if (!transform) return
    const { health: hp, zoneId: zone } = snapshotRef.current
    void saveGame({ transform, health: hp, zoneId: zone }, Date.now())
      .then(() => setHasSaveSlot(true))
      .catch(() => {})
  }, [phase])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Escape') return
      event.preventDefault()
      dispatch(togglePause())
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  const onNewGame = useCallback(() => {
    dispatch(resetPlayer())
    dispatch(resetPlayerHealth())
    dispatch(startNewGame())
  }, [dispatch])

  const onContinue = useCallback(async () => {
    const data = await loadLatest()
    if (!data) return
    // Stage for a scene that boots later; teleport the one already running.
    stageSpawn(data.transform)
    applyPlayerTransform(data.transform)
    dispatch(restorePlayerHealth(data.health))
    dispatch(restorePlayer({ zoneId: data.zoneId }))
    dispatch(continueGame())
  }, [dispatch])

  return (
    <div className="app-shell">
      <GameCanvas />
      {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      {phase !== 'menu' ? (
        <div className="hud">
          <h1>Korovany</h1>
          <div
            className="hud-health"
            role="group"
            aria-label={`Player health: ${health.current} of ${health.max} hit points`}
          >
            <span className="hud-health-label">HP</span>
            <span className="hud-health-bar" aria-hidden="true">
              <span
                className="hud-health-fill"
                style={{ width: `${Math.max(0, (health.current / health.max) * 100)}%` }}
              />
            </span>
            <span className="hud-health-value">
              {health.current}/{health.max}
            </span>
          </div>
        </div>
      ) : null}
      {phase === 'menu' ? (
        <main className="menu-overlay" aria-labelledby="main-menu-title">
          <div className="menu-panel">
            <p className="menu-kicker">Forest vertical slice</p>
            <h1 id="main-menu-title">Korovany</h1>
            <div className="menu-actions" aria-label="Main menu actions">
              <button
                ref={menuPrimaryActionRef}
                type="button"
                className="primary-action"
                onClick={onNewGame}
              >
                New Game
              </button>
              <button
                type="button"
                onClick={() => void onContinue()}
                disabled={!hasSaveSlot}
                aria-disabled={!hasSaveSlot}
              >
                Continue
              </button>
            </div>
            {!hasSaveSlot ? (
              <p className="menu-hint">No saved game yet — start a new game.</p>
            ) : null}
          </div>
        </main>
      ) : null}
      {phase === 'paused' ? (
        <div
          className="pause-overlay"
          role="dialog"
          aria-labelledby="pause-title"
          aria-modal="true"
        >
          <div className="pause-panel">
            <h2 id="pause-title">Paused</h2>
            <div className="menu-actions" aria-label="Pause actions">
              <button
                ref={pausePrimaryActionRef}
                type="button"
                className="primary-action"
                onClick={() => dispatch(togglePause())}
              >
                Resume
              </button>
              <button type="button" onClick={() => dispatch(returnToMenu())}>
                Quit to Main Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
