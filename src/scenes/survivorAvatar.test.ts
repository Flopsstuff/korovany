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

/** A controller-capsule stand-in exposing only what the mount touches. */
function makeMount(scene: Scene) {
  return {
    mesh: MeshBuilder.CreateCapsule('playerCapsule', { radius: 0.35, height: 1.8 }, scene),
    animator: { node: null as AnimatableNode | null },
  }
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
})
