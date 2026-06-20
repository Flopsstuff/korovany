import { useEffect, useRef } from 'react'
import {
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  Vector3,
} from '@babylonjs/core'

/**
 * Minimal Babylon.js canvas — a single rotating cube on a lit scene.
 * Exists to prove the Babylon + React + Vite build path works end-to-end.
 * The real game scenes live alongside this under `src/scenes/`.
 */
export function MainScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)

    const camera = new ArcRotateCamera('camera', Math.PI / 4, Math.PI / 3, 6, Vector3.Zero(), scene)
    camera.attachControl(canvas, true)

    new HemisphericLight('light', new Vector3(0, 1, 0), scene)

    const box = MeshBuilder.CreateBox('box', { size: 2 }, scene)
    scene.onBeforeRenderObservable.add(() => {
      box.rotation.y += 0.01
    })

    engine.runRenderLoop(() => scene.render())

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      engine.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '320px', display: 'block' }} />
}
