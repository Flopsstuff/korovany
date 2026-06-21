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
import { resizeEngineToDisplay } from '../engine'
import { ThirdPersonCamera } from '../game/camera'
import { CharacterController } from '../game/controller'
import { createInputController, type Intent } from '../game/input'
import { FixedStepLoop } from '../game/loop'
import { registerPlayer, takeSpawn } from '../game/save/playerRuntime'
import type { PlayerTransform } from '../game/save/types'
import { mountSurvivorAvatar } from './survivorAvatar'

/**
 * Minimal dev/test scene for the third-person character controller (E1.1).
 *
 * It wires the whole gameplay spine end-to-end — input → fixed-step loop →
 * capsule controller → follow camera — over a flat ground with a few pillars so
 * the camera boom has something to pull in against. This is intentionally not
 * the forest (that wiring is E1.3/E1.5); it exists to prove the controller and
 * camera in isolation and to browser-verify the slice.
 *
 * Controls: **WASD** move, **Shift** sprint, **Space** jump, mouse look (click
 * the canvas to capture the pointer). See `docs/guide/character-controller.md`.
 */
export interface ControllerPlaygroundOptions {
  /** Hero GLB to mount on the capsule. `null` skips it (keeps the bare capsule). */
  heroUrl?: string | null
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
  /**
   * Spawn pose for the capsule. Defaults to whatever Continue staged via
   * `takeSpawn()` (a loaded save), or the playground's default spawn when no save
   * is pending. Pass explicitly in tests.
   */
  initialSpawn?: PlayerTransform | null
}

/** Live handle mirroring {@link import('../engine').GameEngine} so callers tear it down the same way. */
export interface ControllerPlayground {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly controller: CharacterController
  readonly camera: ThirdPersonCamera
  dispose(): void
}

const DEFAULT_HERO_URL = '/models/korovany_hero_player-default.glb'

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

export function createControllerPlayground(
  canvas: HTMLCanvasElement,
  options: ControllerPlaygroundOptions = {},
): ControllerPlayground {
  const {
    heroUrl = DEFAULT_HERO_URL,
    createEngine = defaultEngineFactory,
    initialSpawn = takeSpawn(),
  } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)
  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Ground + a ring of pillars. Pillars are pickable so they both block the
  // camera boom and read as ground when the capsule stands on top of one.
  const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.25, 0.35, 0.22)
  ground.material = groundMat
  ground.isPickable = true

  const pillarMat = new StandardMaterial('pillarMat', scene)
  pillarMat.diffuseColor = new Color3(0.45, 0.4, 0.35)
  for (const [x, z] of [
    [6, 0],
    [-6, 4],
    [0, -7],
    [5, 6],
  ]) {
    const pillar = MeshBuilder.CreateBox('pillar', { width: 1.5, depth: 1.5, height: 5 }, scene)
    pillar.position = new Vector3(x, 2.5, z)
    pillar.material = pillarMat
    pillar.isPickable = true
  }

  // Input: sampled once per render frame and held for the loop's sub-steps.
  const input = createInputController(canvas)
  let frameIntent: Intent = input.sample()

  // The controller owns the capsule; the rig follows that capsule; the
  // controller then takes the rig's camera as its movement basis.
  const spawnPos = initialSpawn
    ? new Vector3(initialSpawn.position.x, initialSpawn.position.y, initialSpawn.position.z)
    : new Vector3(0, 5, 0)
  const controller = new CharacterController({
    scene,
    getIntent: () => frameIntent,
    spawn: spawnPos,
    spawnRotationY: initialSpawn?.rotationY ?? 0,
  })

  // Expose the live capsule to the save system: autosave-on-pause reads the pose,
  // Continue teleports it to a loaded save.
  const unregisterPlayer = registerPlayer({
    read: () => controller.snapshot(),
    write: (transform) => controller.teleport(transform),
  })

  const rig = new ThirdPersonCamera({ scene, target: controller.mesh })
  rig.activate()
  controller.camera = rig.camera

  // Capsule colour as a fallback; hidden once the hero GLB mounts.
  const capsuleMat = new StandardMaterial('capsuleMat', scene)
  capsuleMat.diffuseColor = new Color3(0.3, 0.5, 0.8)
  controller.mesh.material = capsuleMat

  // Player visual: the flat-albedo survivor GLB faceted in-engine (FLO-443),
  // mounted fire-and-forget on the capsule. `null` keeps the bare capsule (tests).
  if (heroUrl !== null) {
    mountSurvivorAvatar(scene, controller, heroUrl)
  }

  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(controller)

  engine.runRenderLoop(() => {
    frameIntent = input.sample()
    loop.advance(engine.getDeltaTime() / 1000)
    // Apply mouse-look + boom once per rendered frame (look deltas are per-frame).
    rig.update(frameIntent.lookDX, frameIntent.lookDY)
    scene.render()
  })

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  const handle = {
    engine,
    scene,
    controller,
    camera: rig,
    dispose() {
      if (disposed) return
      disposed = true
      unregisterPlayer()
      window.removeEventListener('resize', onResize)
      input.dispose()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }

  // Dev-only debug handle so the playground can be inspected from the console.
  if (import.meta.env.DEV) {
    ;(globalThis as Record<string, unknown>).__korovanyPlayground = handle
  }

  return handle
}
