import { useEffect, useRef } from 'react'
import { createGameEngine } from '../engine'
import { useAppDispatch } from '../store'
import { setAssetPhase } from '../store/streamingSlice'

/**
 * Thin React wrapper around the Babylon engine. It owns nothing but the canvas
 * element and the mount/unmount lifecycle: on mount it hands the canvas to
 * {@link createGameEngine}, on unmount it disposes. All engine logic lives in
 * `src/engine/` — keep this component dumb.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const game = createGameEngine(canvas, {
      onAssetLoadingState: (id, phase) => dispatch(setAssetPhase({ id, phase })),
    })
    return () => game.dispose()
  }, [dispatch])

  return <canvas ref={canvasRef} className="render-canvas" />
}
