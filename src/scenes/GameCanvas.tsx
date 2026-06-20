import { useEffect, useRef } from 'react'
import { createGameEngine } from '../engine'
import { useAppDispatch, useAppSelector } from '../store'
import { setAssetPhase } from '../store/streamingSlice'
import { createControllerPlayground } from './controllerPlayground'
import { createForestScene } from './forestScene'

/**
 * Thin React wrapper around the Babylon engine. It owns nothing but the canvas
 * element and the mount/unmount lifecycle.
 *
 * Scene routing:
 * - `?dev=controller` — controller playground (E1.1 QA)
 * - `?dev=forest`     — forest zone standalone (E1.3 QA)
 * - `phase === menu`  — engine smoke scene (hero preview, streaming HUD)
 * - `phase === playing | paused` — forest zone (E1.5 integration)
 *
 * Pause does NOT remount the scene — it keeps `inGame` true so the ForestScene
 * survives ESC toggles. Only the menu↔playing boundary causes a scene swap.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dispatch = useAppDispatch()
  const phase = useAppSelector((state) => state.app.phase)
  const inGame = phase !== 'menu'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dev = new URLSearchParams(window.location.search).get('dev')
    const game =
      dev === 'controller'
        ? createControllerPlayground(canvas)
        : dev === 'forest'
          ? createForestScene(canvas)
          : inGame
            ? createForestScene(canvas)
            : createGameEngine(canvas, {
                onAssetLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
              })
    return () => game.dispose()
  }, [inGame, dispatch])

  return <canvas ref={canvasRef} className="render-canvas" />
}
