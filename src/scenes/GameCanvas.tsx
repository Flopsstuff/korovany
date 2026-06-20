import { useEffect, useRef } from 'react'
import { createGameEngine } from '../engine'
import { useAppDispatch } from '../store'
import { setAssetPhase } from '../store/streamingSlice'
import { createControllerPlayground } from './controllerPlayground'
import { createForestScene } from './forestScene'

/**
 * Thin React wrapper around the Babylon engine. It owns nothing but the canvas
 * element and the mount/unmount lifecycle: on mount it boots a scene against the
 * canvas, on unmount it disposes. All engine logic lives in `src/engine/` (and
 * `src/scenes/`) — keep this component dumb.
 *
 * Dev flags (via `?dev=<value>`):
 * - `controller` — controller playground (E1.1)
 * - `forest`     — forest zone stub (E1.3)
 * Default boots the engine smoke scene and forwards GLB load phases into the store.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dev = new URLSearchParams(window.location.search).get('dev')
    const game =
      dev === 'controller'
        ? createControllerPlayground(canvas)
        : dev === 'forest'
          ? createForestScene(canvas)
          : createGameEngine(canvas, {
              onAssetLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
            })
    return () => game.dispose()
  }, [dispatch])

  return <canvas ref={canvasRef} className="render-canvas" />
}
