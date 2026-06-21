import { type Mesh, NullEngine, Scene } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildMapProps, HUMAN_LANDS_MAP } from '../game/world/mapProps'
import { renderMapProps } from './mapPropsRenderer'

describe('renderMapProps', () => {
  let engine: NullEngine
  let scene: Scene

  beforeEach(() => {
    engine = new NullEngine()
    scene = new Scene(engine)
  })

  afterEach(() => {
    scene.dispose()
    engine.dispose()
  })

  it('renders one thin-instanced base mesh per legend symbol, instancing every prop', () => {
    const root = renderMapProps(scene, HUMAN_LANDS_MAP)
    const bases = root.getChildMeshes(true)
    expect(bases.length).toBeGreaterThan(0)

    // One base mesh per distinct kind present in the resolved specs.
    const specs = buildMapProps(HUMAN_LANDS_MAP)
    const kinds = new Set(specs.map((s) => s.kind))
    expect(bases.length).toBe(kinds.size)

    // Every spec became exactly one thin instance.
    const totalInstances = bases.reduce((n, m) => n + (m as Mesh).thinInstanceCount, 0)
    expect(totalInstances).toBe(specs.length)

    // All props are non-pickable so the controller's ground ray ignores them.
    expect(bases.every((m) => !m.isPickable)).toBe(true)
  })

  it('disposes the whole map (meshes + materials) from the returned root', () => {
    const root = renderMapProps(scene, HUMAN_LANDS_MAP)
    expect(scene.meshes.length).toBeGreaterThan(0)
    root.dispose(false, true)
    expect(scene.getMeshByName('map-prop:R')).toBeNull()
    expect(scene.materials.find((m) => m.name.startsWith('map-prop-mat:'))).toBeUndefined()
  })
})
