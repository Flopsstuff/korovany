import { useEffect, useRef } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import {
  continueGame,
  initHealth,
  returnToMenu,
  selectIsStreamingLoading,
  setSaveExists,
  setSaveLoaded,
  startNewGame,
  togglePause,
  useAppDispatch,
  useAppSelector,
} from '../store'
import { AUTOSAVE_SLOT, hasSave, readSave, writeSave } from '../game/save'

/**
 * App shell: a full-viewport stage holding the 3D canvas with React overlays
 * above it. The app state machine owns coarse flow while Babylon remains
 * isolated behind GameCanvas.
 *
 * See `src/styles/global.css` for the no-scroll, full-page reset and the
 * `.app-shell` / overlay layering.
 */
export function App() {
  const dispatch = useAppDispatch()
  const phase = useAppSelector((state) => state.app.phase)
  const isLoadingAssets = useAppSelector(selectIsStreamingLoading)
  const hasSaveSlot = useAppSelector((state) => state.save.hasSave)
  const score = useAppSelector((state) => state.game.score)
  const playerHp = useAppSelector((state) => state.health.currentHp)
  const playerAlive = useAppSelector((state) => state.health.alive)
  const menuPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const pausePrimaryActionRef = useRef<HTMLButtonElement>(null)

  // Check for autosave on first mount so the Continue button can appear.
  useEffect(() => {
    void hasSave(AUTOSAVE_SLOT).then((exists) => dispatch(setSaveExists(exists)))
  }, [dispatch])

  // Autosave whenever the game is paused.
  useEffect(() => {
    if (phase !== 'paused') return
    void writeSave(AUTOSAVE_SLOT, {
      zoneId: 'forest',
      playerPos: { x: 0, y: 0, z: 0 },
      score,
      hp: playerHp,
      savedAt: Date.now(),
    }).then(() => dispatch(setSaveExists(true)))
  }, [phase, score, playerHp, dispatch])

  // Death returns to the menu (respawn is Phase 6).
  useEffect(() => {
    if (phase === 'playing' && !playerAlive) dispatch(returnToMenu())
  }, [phase, playerAlive, dispatch])

  useEffect(() => {
    if (phase === 'menu') menuPrimaryActionRef.current?.focus()
    else if (phase === 'paused') pausePrimaryActionRef.current?.focus()
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

  function handleNewGame() {
    dispatch(initHealth(null))
    dispatch(startNewGame())
  }

  function handleContinue() {
    void readSave(AUTOSAVE_SLOT).then((save) => {
      if (save) dispatch(setSaveLoaded(save))
      dispatch(initHealth(save))
      dispatch(continueGame())
    })
  }

  return (
    <div className="app-shell">
      <GameCanvas />
      {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      {phase !== 'menu' ? (
        <div className="hud">
          <h1>Korovany</h1>
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
                onClick={handleNewGame}
              >
                New Game
              </button>
              {hasSaveSlot ? (
                <button type="button" onClick={handleContinue}>
                  Continue
                </button>
              ) : null}
            </div>
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
