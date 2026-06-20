import { NullEngine, Scene, TransformNode, type AbstractMesh } from '@babylonjs/core'
import { describe, expect, it, vi } from 'vitest'
import type { LoadedModel } from '../../scenes/modelLoader'
import { AssetRegistry } from './registry'
import { AssetStreamLoader } from './loader'

function makeLoadedModel(scene: Scene, tag: string): LoadedModel {
  const root = new TransformNode(`root:${tag}`, scene)
  const mesh = {
    parent: null as TransformNode | null,
    dispose: vi.fn(),
  } as unknown as AbstractMesh
  mesh.parent = root
  return { root, meshes: [mesh] }
}

function bootLoader(loadGlb = vi.fn()) {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const registry = new AssetRegistry()
  registry.register('hero', { url: '/models/hero.glb', metadata: {} })
  const loader = new AssetStreamLoader(scene, registry, loadGlb)
  return { engine, scene, loader, loadGlb }
}

describe('AssetStreamLoader', () => {
  it('invokes the loader only once for concurrent acquires of the same id', async () => {
    const { scene, loader, loadGlb } = bootLoader()
    const model = makeLoadedModel(scene, 'hero')
    loadGlb.mockResolvedValue(model)

    const [a, b] = await Promise.all([loader.acquire('hero'), loader.acquire('hero')])

    expect(loadGlb).toHaveBeenCalledTimes(1)
    expect(a).toBe(model)
    expect(b).toBe(model)
    expect(loader.getPhase('hero')).toBe('loaded')
  })

  it('re-fetches after full release when ref-count reaches zero', async () => {
    const { scene, loader, loadGlb } = bootLoader()
    const model = makeLoadedModel(scene, 'hero')
    loadGlb.mockResolvedValue(model)

    const first = await loader.acquire('hero')
    loader.release('hero')
    const second = await loader.acquire('hero')

    expect(loadGlb).toHaveBeenCalledTimes(2)
    expect(second).toBe(model)
    expect(first).toBe(model)
  })

  it('disposes meshes and root when ref-count reaches zero', async () => {
    const { scene, loader, loadGlb } = bootLoader()
    const model = makeLoadedModel(scene, 'hero')
    const disposeRoot = vi.spyOn(model.root, 'dispose')
    loadGlb.mockResolvedValue(model)

    await loader.acquire('hero')
    loader.release('hero')

    expect(model.meshes[0].dispose).toHaveBeenCalledWith(false, true)
    expect(disposeRoot).toHaveBeenCalled()
    expect(loader.getPhase('hero')).toBe('idle')
  })

  it('surfaces error phase without leaving a partial cache entry', async () => {
    const { loader, loadGlb } = bootLoader()
    loadGlb.mockRejectedValue(new Error('network'))

    await expect(loader.acquire('hero')).rejects.toThrow('network')
    expect(loader.getPhase('hero')).toBe('error')
  })
})
