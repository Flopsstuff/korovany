import { useEffect } from 'react'
import { GameCanvas } from '../scenes/GameCanvas'
import {
  continueGame,
  startNewGame,
  togglePause,
  useAppDispatch,
  useAppSelector,
} from '../store'
import { selectIsStreamingLoading } from '../store'

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Escape') return
      event.preventDefault()
      dispatch(togglePause())
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  return (
    <div className="app-shell">
      <GameCanvas />
      <div className="hud">
        <h1>Korovany</h1>
        {isLoadingAssets ? <p className="hud-loading">Loading…</p> : null}
      </div>
      {phase === 'menu' ? (
        <main className="menu-overlay" aria-labelledby="main-menu-title">
          <div className="menu-panel">
            <p className="menu-kicker">Forest vertical slice</p>
            <h2 id="main-menu-title">Korovany</h2>
            <div className="menu-actions" aria-label="Main menu actions">
              <button type="button" onClick={() => dispatch(startNewGame())}>
                New Game
              </button>
              <button type="button" onClick={() => dispatch(continueGame())}>
                Continue
              </button>
              <button type="button">Settings</button>
            </div>
          </div>
        </main>
      ) : null}
      {phase === 'paused' ? (
        <div className="pause-overlay" role="status" aria-live="polite">
          <div className="pause-panel">
            <h2>Paused</h2>
            <p>Press ESC to resume.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
