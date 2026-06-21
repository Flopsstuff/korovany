import {
  ArcRotateCamera,
  MeshBuilder,
  NullEngine,
  Scene,
  Vector3,
} from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Intent } from '../input'
import { FixedStepLoop } from '../loop'
import { ThirdPersonCamera } from '../camera'
import { CharacterController } from './characterController'

const DT = 1 / 60

const NEUTRAL: Intent = {
  moveX: 0,
  moveY: 0,
  jump: false,
  sprint: false,
  attack: false,
  lookDX: 0,
  lookDY: 0,
}

// A headless Babylon world with a flat ground plane. NullEngine has no GPU, but
// CPU ray-picking against real mesh geometry works, so the controller's ground
// ray and the camera boom exercise the same code paths as the browser.
function makeWorld() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, 1, 6, Vector3.Zero(), scene)
  const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene)
  ground.isPickable = true
  return { engine, scene, camera, ground }
}

describe('CharacterController (NullEngine)', () => {
  let world: ReturnType<typeof makeWorld>
  let intent: Intent

  beforeEach(() => {
    world = makeWorld()
    intent = { ...NEUTRAL }
  })
  afterEach(() => {
    world.scene.dispose()
    world.engine.dispose()
  })

  function makeController(spawnY = 5) {
    return new CharacterController({
      scene: world.scene,
      camera: world.camera,
      getIntent: () => intent,
      spawn: new Vector3(0, spawnY, 0),
      capsuleHeight: 1.8,
    })
  }

  it('falls under gravity and lands resting on the ground plane', () => {
    const controller = makeController(5)
    for (let i = 0; i < 240; i++) controller.update(DT) // ~4 s of sim
    expect(controller.grounded).toBe(true)
    // Capsule origin rests at ground (0) + half of the 1.8 height.
    expect(controller.mesh.position.y).toBeCloseTo(0.9, 2)
  })

  it('walks horizontally when forward intent is held', () => {
    const controller = makeController(0.9) // already grounded
    controller.update(DT) // settle grounded
    const startZ = controller.mesh.position.z
    intent = { ...NEUTRAL, moveY: 1 }
    for (let i = 0; i < 30; i++) controller.update(DT)
    // Camera looks down -Z from alpha=-π/2, so "forward" carries the capsule.
    expect(Math.abs(controller.mesh.position.z - startZ)).toBeGreaterThan(0.5)
    expect(controller.grounded).toBe(true)
  })

  it('scales horizontal travel by the locomotion speed multiplier (leg-loss crawl)', () => {
    // A crawling player (one leg severed → 0.35×) must cover proportionally less
    // ground than a fully-mobile player over the same number of steps (MPG.6).
    function walkDistance(multiplier: number): number {
      const controller = new CharacterController({
        scene: world.scene,
        camera: world.camera,
        getIntent: () => intent,
        getSpeedMultiplier: () => multiplier,
        spawn: new Vector3(0, 0.9, 0),
        capsuleHeight: 1.8,
      })
      controller.update(DT) // settle grounded
      const startZ = controller.mesh.position.z
      intent = { ...NEUTRAL, moveY: 1 }
      for (let i = 0; i < 30; i++) controller.update(DT)
      const distance = Math.abs(controller.mesh.position.z - startZ)
      controller.dispose()
      intent = { ...NEUTRAL }
      return distance
    }

    const full = walkDistance(1)
    const crawl = walkDistance(0.35)
    expect(crawl).toBeGreaterThan(0)
    expect(crawl).toBeLessThan(full)
    expect(crawl / full).toBeCloseTo(0.35, 1)
  })

  it('jumps off the ground and leaves it', () => {
    const controller = makeController(0.9)
    controller.update(DT)
    expect(controller.grounded).toBe(true)
    const restY = controller.mesh.position.y
    intent = { ...NEUTRAL, jump: true }
    controller.update(DT)
    expect(controller.grounded).toBe(false)
    expect(controller.mesh.position.y).toBeGreaterThan(restY)
  })

  it('ignores its own parented visual mesh when probing for ground', () => {
    const controller = makeController(5)
    // A pickable hero-style visual riding on the capsule must NOT register as
    // ground (else the capsule clamps onto itself and flies upward).
    const visual = MeshBuilder.CreateBox('heroVisual', { size: 1 }, world.scene)
    visual.parent = controller.mesh
    visual.isPickable = true
    for (let i = 0; i < 240; i++) controller.update(DT)
    expect(controller.mesh.position.y).toBeCloseTo(0.9, 2) // landed on the real ground
  })

  it('runs as a scheduler System under the fixed-step loop', () => {
    const controller = makeController(5)
    const loop = new FixedStepLoop({ world: undefined, dt: DT })
    loop.scheduler.register(controller)
    // 0.5 s of real frames worth of accumulated time.
    for (let i = 0; i < 30; i++) loop.advance(DT)
    expect(controller.mesh.position.y).toBeLessThan(5) // it actually fell
  })
})

describe('ThirdPersonCamera (NullEngine)', () => {
  let world: ReturnType<typeof makeWorld>
  let intent: Intent

  beforeEach(() => {
    world = makeWorld()
    intent = { ...NEUTRAL }
  })
  afterEach(() => {
    world.scene.dispose()
    world.engine.dispose()
  })

  it('follows the player capsule via a locked target', () => {
    const controller = new CharacterController({
      scene: world.scene,
      camera: world.camera,
      getIntent: () => intent,
      spawn: new Vector3(3, 0.9, -2),
    })
    const rig = new ThirdPersonCamera({ scene: world.scene, target: controller.mesh })
    expect(rig.camera.lockedTarget).toBe(controller.mesh)
  })

  it('orbits yaw when given a horizontal look delta', () => {
    const target = MeshBuilder.CreateCapsule('p', { height: 1.8 }, world.scene)
    target.position = new Vector3(0, 5, 0) // clear of the ground plane
    target.isPickable = false
    const rig = new ThirdPersonCamera({ scene: world.scene, target })
    const before = rig.orbitAngles.alpha
    rig.update(100, 0)
    expect(rig.orbitAngles.alpha).not.toBeCloseTo(before, 3)
    expect(rig.camera.radius).toBeLessThanOrEqual(6 + 1e-6)
  })

  it('pulls the boom in when geometry occludes the player', () => {
    const target = MeshBuilder.CreateCapsule('p', { height: 1.8 }, world.scene)
    target.position = new Vector3(0, 5, 0) // clear of the ground plane
    target.isPickable = false
    const rig = new ThirdPersonCamera({ scene: world.scene, target })
    rig.update(0, 0)
    const openRadius = rig.camera.radius
    // Drop a big wall right where the boom extends and re-resolve.
    const wall = MeshBuilder.CreateBox('wall', { size: 8 }, world.scene)
    wall.position = rig.camera.position.clone()
    wall.isPickable = true
    rig.update(0, 0)
    expect(rig.camera.radius).toBeLessThan(openRadius)
  })
})

describe('CharacterController save bridge', () => {
  let world: ReturnType<typeof makeWorld>

  beforeEach(() => {
    world = makeWorld()
  })
  afterEach(() => {
    world.scene.dispose()
    world.engine.dispose()
  })

  it('spawns at a given pose and snapshots it back', () => {
    const controller = new CharacterController({
      scene: world.scene,
      getIntent: () => NEUTRAL,
      spawn: new Vector3(3, 2, -1),
      spawnRotationY: 0.75,
    })
    expect(controller.snapshot()).toEqual({
      position: { x: 3, y: 2, z: -1 },
      rotationY: 0.75,
    })
  })

  it('teleports to a restored pose and holds it across a sim step', () => {
    const controller = new CharacterController({
      scene: world.scene,
      getIntent: () => NEUTRAL,
      spawn: new Vector3(0, 5, 0),
    })
    controller.teleport({ position: { x: 8, y: 10, z: 4 }, rotationY: -1.5 })

    const snap = controller.snapshot()
    expect(snap.position).toEqual({ x: 8, y: 10, z: 4 })
    expect(snap.rotationY).toBeCloseTo(-1.5, 5)

    // A neutral step must not snap the authoritative position back to spawn; it
    // should only fall from the teleported height (no ground within reach here).
    controller.update(DT)
    expect(controller.snapshot().position.x).toBeCloseTo(8, 5)
    expect(controller.snapshot().position.z).toBeCloseTo(4, 5)
  })

  it('edge-fires the combat visual swap on idle↔swing transitions (FLO-481)', () => {
    const controller = new CharacterController({ scene: world.scene, getIntent: () => NEUTRAL })
    const calls: boolean[] = []
    controller.registerCombatVisual((inCombat) => calls.push(inCombat))

    // Through a full swing the swap fires exactly twice: on enter and on exit, not
    // on every intra-swing phase change — the visual only has two states.
    controller.setAttackPhase('windup')
    controller.setAttackPhase('active')
    controller.setAttackPhase('recovery')
    controller.setAttackPhase('idle')

    expect(calls).toEqual([true, false])
  })

  it('does not fire the combat swap while staying idle', () => {
    const controller = new CharacterController({ scene: world.scene, getIntent: () => NEUTRAL })
    const calls: boolean[] = []
    controller.registerCombatVisual((inCombat) => calls.push(inCombat))

    controller.setAttackPhase('idle')

    expect(calls).toEqual([])
  })
})
