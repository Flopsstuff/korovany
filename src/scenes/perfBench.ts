import {
  type AbstractEngine,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core'
import { resizeEngineToDisplay } from '../engine'
import { loadModel, type LoadedModel } from './modelLoader'
import {
  createInstancedVegetation,
  type InstancedVegetation,
  type VegetationPlacement,
} from '../game/streaming/instancedVegetation'
import {
  createFrameProfiler,
  createPerfHud,
  formatBudgetReport,
  type FrameProfiler,
  type PerfHud,
} from '../game/perf'

/**
 * Performance-budget bench (E5.4, FLO-398) — `?dev=perf`.
 *
 * Plants a dense `GRID × GRID` thin-instanced forest (the E5.3 batch) and runs a
 * live {@link FrameProfiler} against the 60fps-on-mid-hardware budget, rendering
 * the verdict in a {@link PerfHud} overlay. This is the profiling tool the budget
 * is meant to be tuned with: fly the camera (**WASD** + mouse) through the forest
 * and watch fps / frame-ms / draw-calls / active-indices against their ceilings.
 *
 * Every second it also logs the windowed report to the console and mirrors the
 * latest report onto `window.__korovanyPerfBench` for smoke harnesses.
 */

const GRID = 24 // 24×24 = 576 trees — a deliberately heavy forest
const SPACING = 5

export interface PerfBench {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly profiler: FrameProfiler
  dispose(): void
}

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

export interface PerfBenchOptions {
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /** Inject a loader so tests can run without fetching the real GLB. */
  loadTree?: (scene: Scene) => Promise<LoadedModel>
  /** Mount the HUD here (test seam); defaults to `document.body`. */
  hudParent?: HTMLElement
  /** Called once the forest is planted (test seam). */
  onPlanted?: (vegetation: InstancedVegetation) => void
}

function gridPlacements(): VegetationPlacement[] {
  const span = (GRID - 1) * SPACING
  const placements: VegetationPlacement[] = []
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      placements.push({
        position: { x: -span / 2 + i * SPACING, y: 0, z: -span / 2 + j * SPACING },
        rotationY: ((i * 7 + j * 13) % 360) * (Math.PI / 180),
      })
    }
  }
  return placements
}

export function createPerfBench(
  canvas: HTMLCanvasElement,
  options: PerfBenchOptions = {},
): PerfBench {
  const {
    createEngine = defaultEngineFactory,
    loadTree = (scene) => loadModel(scene, '/models/forest-tree.glb', { targetSize: 4 }),
    hudParent,
    onPlanted,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.5, 0.7, 0.9, 1)
  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: GRID * SPACING + 20, height: GRID * SPACING + 20 },
    scene,
  )
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.2, 0.38, 0.15)
  ground.material = groundMat

  const span = (GRID - 1) * SPACING
  const camera = new UniversalCamera('benchCam', new Vector3(0, 4, -span), scene)
  camera.setTarget(new Vector3(0, 2, 0))
  camera.attachControl(canvas, true)
  camera.keysUp = [87] // W
  camera.keysDown = [83] // S
  camera.keysLeft = [65] // A
  camera.keysRight = [68] // D
  camera.speed = 1.2

  const profiler = createFrameProfiler(scene)
  const hud = createPerfHud(hudParent)

  let vegetation: InstancedVegetation | null = null
  void loadTree(scene)
    .then((tree) => {
      tree.root.position.set(0, 0, 0)
      vegetation = createInstancedVegetation(tree.root, tree.meshes, gridPlacements())
      onPlanted?.(vegetation)
    })
    .catch((err: unknown) => {
      console.error('[perf-bench] failed to plant forest', err)
    })

  let sinceLog = 0
  engine.runRenderLoop(() => {
    scene.render()
    const report = profiler.sample()
    hud.update(report)
    sinceLog += engine.getDeltaTime()
    if (sinceLog >= 1000) {
      sinceLog = 0
      console.info(`[perf-bench] ${formatBudgetReport(report)}`)
      if (import.meta.env.DEV) {
        ;(globalThis as Record<string, unknown>).__korovanyPerfBench = {
          metrics: profiler.current(),
          report,
        }
      }
    }
  })

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  return {
    engine,
    scene,
    profiler,
    dispose() {
      if (disposed) return
      disposed = true
      window.removeEventListener('resize', onResize)
      engine.stopRenderLoop()
      hud.dispose()
      profiler.dispose()
      vegetation?.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
