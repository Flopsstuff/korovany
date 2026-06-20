import { useEffect, useRef } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import {
  returnToMenu,
  selectIsStreamingLoading,
  startNewGame,
  togglePause,
  useAppDispatch,
  useAppSelector,
} from '../store'

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
  const menuPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const pausePrimaryActionRef = useRef<HTMLButtonElement>(null)
  const isLoadingAssets = useAppSelector(selectIsStreamingLoading)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Escape') return
      event.preventDefault()
      dispatch(togglePause())
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  useEffect(() => {
    if (phase === 'menu') {
      menuPrimaryActionRef.current?.focus()
    } else if (phase === 'paused') {
      pausePrimaryActionRef.current?.focus()
    }
  }, [phase])

  return (
    <div className="app-shell">
      <GameCanvas />
      <div className="hud">
        {phase === 'menu' ? null : <h1>Korovany</h1>}
        {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      </div>
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
                onClick={() => dispatch(startNewGame())}
              >
                New Game
              </button>
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
            <p>Press ESC or resume from the menu.</p>
            <div className="menu-actions" aria-label="Pause menu actions">
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
