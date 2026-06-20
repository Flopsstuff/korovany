import {
  type AbstractEngine,
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from '@babylonjs/core'
import {
  createAssetStreaming,
  HERO_PLAYER_ASSET_ID,
  spawnStreamedInstance,
  type AssetLoadingStateListener,
} from '../game/streaming'

/**
 * Korovany rendering engine — the single owner of the Babylon `Engine`/`Scene`
 * lifecycle. React components must NOT `new Engine(...)` inline; they mount a
 * canvas, call {@link createGameEngine}, and call {@link GameEngine.dispose} on
 * unmount. Keeping the engine out of the component tree means the render loop,
 * resize wiring, and teardown live in one testable place
 * (see `src/scenes/GameCanvas.tsx` for the thin wrapper).
 */

/** The slice of the Babylon engine API the responsive resize logic needs. */
export interface ResizableEngine {
  setHardwareScalingLevel(level: number): void
  resize(): void
}

/**
 * Resize a Babylon engine to its canvas's current CSS size while keeping the
 * render crisp on high-DPR (retina) displays.
 *
 * Babylon's backing buffer is `cssPixels / hardwareScalingLevel`, so a scaling
 * level of `1 / devicePixelRatio` makes the render target match the physical
 * device pixels (1 CSS px → `dpr` device px). We re-apply this on every resize
 * because the DPR can change at runtime — e.g. dragging the window between a
 * retina and a non-retina monitor, or changing the browser zoom.
 *
 * A non-positive or `NaN` DPR (jsdom, headless contexts) falls back to `1`.
 */
export function resizeEngineToDisplay(engine: ResizableEngine, devicePixelRatio: number): void {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1
  engine.setHardwareScalingLevel(1 / dpr)
  engine.resize()
}

/** A live engine instance plus the handle React uses to tear it down. */
export interface GameEngine {
  readonly engine: AbstractEngine
  readonly scene: Scene
  /** Stop the render loop, drop the resize listener, and dispose GPU resources. Idempotent. */
  dispose(): void
}

export interface CreateGameEngineOptions {
  /**
   * Asset id to stream as a render smoke (placeholder box → GLB).
   * Defaults to the player hero; pass `null` to skip (e.g. in unit tests).
   */
  streamAssetId?: string | null
  /** Called when a streamed asset changes load phase (wired to Redux in GameCanvas). */
  onAssetLoadingState?: AssetLoadingStateListener
  /**
   * Engine factory — injectable so tests can pass a headless `NullEngine`.
   * Defaults to a WebGL `Engine` with `adaptToDeviceRatio` enabled.
   */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
}

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  // 4th arg `adaptToDeviceRatio` sizes the initial backing buffer to the device
  // pixels; `resizeEngineToDisplay` keeps it correct as the DPR changes.
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/**
 * Boot a full Babylon scene against `canvas` and start rendering.
 *
 * The caller owns the canvas element (typically a React `ref`); this function
 * owns everything Babylon. Always pair a call with {@link GameEngine.dispose}.
 */
export function createGameEngine(
  canvas: HTMLCanvasElement,
  options: CreateGameEngineOptions = {},
): GameEngine {
  const {
    streamAssetId = HERO_PLAYER_ASSET_ID,
    onAssetLoadingState,
    createEngine = defaultEngineFactory,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  const camera = new ArcRotateCamera('camera', Math.PI / 4, Math.PI / 3, 6, Vector3.Zero(), scene)
  camera.attachControl(canvas, true)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  const streamed: Array<{ release: () => void }> = []
  if (streamAssetId) {
    const { loader } = createAssetStreaming(scene, { onLoadingState: onAssetLoadingState })
    void spawnStreamedInstance(loader, scene, streamAssetId).then((instance) => {
      streamed.push(instance)
    })
  }

  engine.runRenderLoop(() => scene.render())

  // Fill the viewport and stay crisp on retina; re-run whenever the window
  // (and thus the full-page canvas) changes size or moves across displays.
  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  return {
    engine,
    scene,
    dispose() {
      if (disposed) return
      disposed = true
      window.removeEventListener('resize', onResize)
      for (const instance of streamed) instance.release()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }
}
