import {
  Color3,
  Mesh,
  MeshBuilder,
  NullEngine,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnimatableNode } from '../game/animation/proceduralAnimator'
import type { LoadedModel } from './modelLoader'

// jsdom has no WebGL, so drive the wiring through a headless NullEngine. The GLB
// fetch never happens: wireSurvivorAvatar takes an already-loaded model, and the
// mount test mocks loadModel — so this is a true headless load-path test.
function makeScene(): Scene {
  return new Scene(new NullEngine())
}

/** A LoadedModel-shaped fixture: a placement root + two textured geometry boxes. */
function makeModel(scene: Scene): LoadedModel {
  const root = new TransformNode('model:hero', scene)
  const body = MeshBuilder.CreateBox('hero-body', {}, scene)
  const head = MeshBuilder.CreateBox('hero-head', {}, scene)
  for (const m of [body, head]) {
    const mat = new StandardMaterial(`${m.name}-mat`, scene)
    mat.specularColor = new Color3(0.8, 0.8, 0.8) // glossy on import — must be tamed
    m.material = mat
    m.parent = root
  }
  return { root, meshes: [body, head] }
}

/**
 * A controller-capsule stand-in exposing only what the mount touches. Captures
 * the combat-visual swap so tests can drive it directly (FLO-481).
 */
function makeMount(scene: Scene) {
  const mount = {
    mesh: MeshBuilder.CreateCapsule('playerCapsule', { radius: 0.35, height: 1.8 }, scene),
    animator: { node: null as AnimatableNode | null },
    combatSwap: null as ((inCombat: boolean) => void) | null,
    registerCombatVisual(swap: (inCombat: boolean) => void) {
      this.combatSwap = swap
    },
  }
  return mount
}

describe('wireSurvivorAvatar (FLO-443)', () => {
  it('facets every geometry mesh and makes it non-pickable', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)
    const spies = model.meshes.map((m) =>
      vi.spyOn(m as Mesh, 'convertToFlatShadedMesh'),
    )

    wireSurvivorAvatar(makeMount(scene), model)

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
    for (const m of model.meshes) expect(m.isPickable).toBe(false)
  })

  it('skips convertToFlatShadedMesh on a geometry-less root pivot', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const pivot = new Mesh('__root__', scene) // no vertex data
    const spy = vi.spyOn(pivot, 'convertToFlatShadedMesh')
    const model: LoadedModel = { root: new TransformNode('model:hero', scene), meshes: [pivot] }

    wireSurvivorAvatar(makeMount(scene), model)

    expect(spy).not.toHaveBeenCalled()
  })

  it('tames the imported material to a matte near-zero-specular read', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)

    wireSurvivorAvatar(makeMount(scene), model)

    for (const m of model.meshes) {
      const mat = m.material as StandardMaterial
      expect(mat.specularColor.r).toBeLessThan(0.1)
      expect(mat.specularColor.g).toBeLessThan(0.1)
      expect(mat.specularColor.b).toBeLessThan(0.1)
    }
  })

  it('parents the root under the capsule at the foot offset and hides the capsule', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)
    const mount = makeMount(scene)

    wireSurvivorAvatar(mount, model)

    expect(model.root.parent).toBe(mount.mesh)
    expect(model.root.position.equals(new Vector3(0, -0.9, 0))).toBe(true)
    expect(mount.mesh.isVisible).toBe(false)
  })

  it('wires the visual root into the animator (deferred node contract)', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)
    const mount = makeMount(scene)
    expect(mount.animator.node).toBeNull()

    wireSurvivorAvatar(mount, model)

    expect(mount.animator.node).toBe(model.root)
  })

  it('does not register a combat swap when no attack model is supplied', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const mount = makeMount(scene)

    wireSurvivorAvatar(mount, makeModel(scene))

    expect(mount.combatSwap).toBeNull()
  })
})

describe('combat-state model swap (FLO-481)', () => {
  it('mounts the attack twin hidden and facets both models', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)
    const attack = makeModel(scene)
    const spies = [...model.meshes, ...attack.meshes].map((m) =>
      vi.spyOn(m as Mesh, 'convertToFlatShadedMesh'),
    )

    wireSurvivorAvatar(makeMount(scene), model, attack)

    // Both models are faceted and parented; the default shows, attack starts hidden.
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
    expect(model.root.parent).toBe(attack.root.parent) // both under the capsule
    expect(model.root.isEnabled()).toBe(true)
    expect(attack.root.isEnabled()).toBe(false)
  })

  it('swaps default↔attack visibility when combat state toggles', async () => {
    const scene = makeScene()
    const { wireSurvivorAvatar } = await import('./survivorAvatar')
    const model = makeModel(scene)
    const attack = makeModel(scene)
    const mount = makeMount(scene)

    wireSurvivorAvatar(mount, model, attack)
    expect(mount.combatSwap).not.toBeNull()

    // Enter combat: attack pose shows, neutral hides.
    mount.combatSwap!(true)
    expect(model.root.isEnabled()).toBe(false)
    expect(attack.root.isEnabled()).toBe(true)

    // Leave combat: back to the neutral pose.
    mount.combatSwap!(false)
    expect(model.root.isEnabled()).toBe(true)
    expect(attack.root.isEnabled()).toBe(false)
  })
})

describe('mountSurvivorAvatar (fire-and-forget load path, FLO-443)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('loads the GLB headlessly, facets it, and wires the animator', async () => {
    const scene = makeScene()
    let captured: LoadedModel | null = null
    // Clear the module cache first so the dynamic import below picks up the mock
    // (the wireSurvivorAvatar describe imported the real module earlier).
    vi.resetModules()
    vi.doMock('./modelLoader', () => ({
      loadModel: vi.fn((s: Scene) => {
        captured = makeModel(s)
        return Promise.resolve(captured)
      }),
    }))
    const { mountSurvivorAvatar } = await import('./survivorAvatar')
    const mount = makeMount(scene)

    mountSurvivorAvatar(scene, mount, '/models/korovany_hero_player-default.glb')
    // Let the resolved load promise flush so the .then() wiring runs.
    await Promise.resolve()
    await Promise.resolve()

    expect(captured).not.toBeNull()
    expect(mount.animator.node).toBe(captured!.root)
    expect(mount.mesh.isVisible).toBe(false)
    for (const m of captured!.meshes) expect(m.isPickable).toBe(false)
  })

  it('loads both GLBs and registers the combat swap when an attack URL is given', async () => {
    const scene = makeScene()
    const loaded: LoadedModel[] = []
    vi.resetModules()
    vi.doMock('./modelLoader', () => ({
      loadModel: vi.fn((s: Scene) => {
        const m = makeModel(s)
        loaded.push(m)
        return Promise.resolve(m)
      }),
    }))
    const { mountSurvivorAvatar } = await import('./survivorAvatar')
    const mount = makeMount(scene)

    mountSurvivorAvatar(
      scene,
      mount,
      '/models/korovany_hero_player-default.glb',
      '/models/korovany_hero_player-attack.glb',
    )
    // Flush both the Promise.all and the chained .then() wiring.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(loaded).toHaveLength(2) // default + attack
    expect(mount.combatSwap).not.toBeNull()
    // The default is the one handed to the animator; the other is the attack twin.
    const defaultModel = loaded.find((m) => m.root === mount.animator.node)!
    const attackModel = loaded.find((m) => m.root !== mount.animator.node)!
    expect(defaultModel.root.isEnabled()).toBe(true)
    expect(attackModel.root.isEnabled()).toBe(false)
  })
})
