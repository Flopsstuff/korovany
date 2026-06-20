import {
  type AbstractEngine,
  Color3,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { createWorldBounds } from './worldBounds'
import { resizeEngineToDisplay } from '../engine'
import { ThirdPersonCamera } from '../game/camera'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import { registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save'

/** Zone id used for the human-lands scene's save/corpse persistence. */
export const HUMAN_LANDS_ZONE_ID = 'human-lands'

export interface HumanLandsSceneOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /** Hero GLB to mount on the capsule; `null` skips it (tests). */
  heroUrl?: string | null
  /**
   * Spawn pose for the player capsule. Defaults to a staged fast-travel/Continue
   * spawn (`takeSpawn()`), falling back to the road centre.
   */
  initialSpawn?: PlayerTransform | null
  /**
   * Pause gate (FLO-326). While this returns `true` the per-frame simulation is
   * frozen but the scene keeps rendering under the React pause overlay.
   */
  isPaused?: () => boolean
  /** Combat is not modelled in this stub; accepted for a uniform zone-scene API. */
  onPlayerDamaged?: (amount: number) => void
}

export interface HumanLandsScene {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  /** Advance one frame by `dt` seconds (tests drive this directly). */
  step(dt: number): void
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

/** Marker boxes standing in for the Salt Road's landmarks (toll gate, shrine,
 * watchtower) so the zone reads as visually distinct from the forest. Each is
 * `[x, z, height, r, g, b]`. Replaced by streamed GLBs in a later asset ticket. */
const LANDMARKS: [number, number, number, number, number, number][] = [
  [10, 8, 5, 0.55, 0.5, 0.45], // watchtower silhouette
  [-9, 6, 2, 0.6, 0.55, 0.4], // roadside shrine
  [-12, -8, 3, 0.45, 0.35, 0.3], // broken toll gate
]

/**
 * Phase-3 Human-lands ("Salt Road of Velya") stub zone (E3.1). A flat dusty road
 * plane with a few landmark blocks and the full third-person controller rig —
 * just enough to prove fast-travel lands the player in a different, navigable
 * scene. Streamed road props and the caravan loop arrive in later tickets
 * (see `docs/guide/world-specs.md` §1).
 */
export function createHumanLandsScene(
  canvas: HTMLCanvasElement,
  options: HumanLandsSceneOptions = {},
): HumanLandsScene {
  const {
    createEngine = defaultEngineFactory,
    heroUrl = DEFAULT_HERO_URL,
    initialSpawn = takeSpawn(),
    isPaused,
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)

  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Dusty trade-road ground (tan), visually distinct from the forest's green,
  // walled by a perimeter bounding box (FLO-368). `clampToWorld` keeps the
  // capsule inside the walls each frame (the controller has no wall collision).
  const { clamp: clampToWorld } = createWorldBounds(scene, new Color3(0.62, 0.55, 0.38))

  const landmarkMeshes = LANDMARKS.map(([x, z, h, r, g, b], i) => {
    const box = MeshBuilder.CreateBox(`landmark-${i}`, { size: 2, height: h }, scene)
    box.position = new Vector3(x, h / 2, z)
    const mat = new StandardMaterial(`landmarkMat-${i}`, scene)
    mat.diffuseColor = new Color3(r, g, b)
    box.material = mat
    return box
  })

  // ------------------------------------------------------------------
  // Character controller + follow camera (same rig as the forest scene).
  // ------------------------------------------------------------------
  const input = createInputController(canvas)
  let frameIntent: Intent = input.sample()

  const spawnPos = initialSpawn
    ? new Vector3(initialSpawn.position.x, initialSpawn.position.y, initialSpawn.position.z)
    : new Vector3(0, 2, 0)
  const controller = new CharacterController({
    scene,
    getIntent: () => frameIntent,
    spawn: spawnPos,
    spawnRotationY: initialSpawn?.rotationY ?? 0,
  })

  const unregisterPlayer = registerPlayer({
    read: () => controller.snapshot(),
    write: (transform) => controller.teleport(transform),
  })

  const rig = new ThirdPersonCamera({ scene, target: controller.mesh })
  rig.activate()
  controller.camera = rig.camera

  const capsuleMat = new StandardMaterial('capsuleMat', scene)
  capsuleMat.diffuseColor = new Color3(0.3, 0.5, 0.8)
  controller.mesh.material = capsuleMat
  controller.mesh.isVisible = false

  if (heroUrl) {
    void import('./modelLoader').then(({ loadModel }) =>
      loadModel(scene, heroUrl, { targetSize: 1.8, groundIt: true }).then((hero) => {
        hero.root.parent = controller.mesh
        hero.root.position = new Vector3(0, -0.9, 0)
        for (const mesh of hero.meshes) mesh.isPickable = false
      }),
    )
  }

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)

  const frame = (dt: number) => {
    if (isPaused?.()) {
      scene.render()
      return
    }
    frameIntent = input.sample()
    loop.advance(dt)
    clampToWorld(controller.mesh.position) // contain the player within the world bounds
    rig.update(frameIntent.lookDX, frameIntent.lookDY)
    scene.render()
  }

  engine.runRenderLoop(() => frame(engine.getDeltaTime() / 1000))

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  return {
    engine,
    scene,
    controller,
    step: frame,
    dispose() {
      if (disposed) return
      disposed = true
      unregisterPlayer()
      window.removeEventListener('resize', onResize)
      input.dispose()
      engine.stopRenderLoop()
      for (const mesh of landmarkMeshes) mesh.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
