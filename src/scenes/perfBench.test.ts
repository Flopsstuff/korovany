import { MeshBuilder, NullEngine, Scene, TransformNode } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { createPerfBench } from './perfBench'
import type { InstancedVegetation } from '../game/streaming/instancedVegetation'
import type { LoadedModel } from './modelLoader'

/** A synthetic tree model (canopy sphere + trunk box under one root). */
function fakeTree(scene: Scene): LoadedModel {
  const root = new TransformNode('tree', scene)
  const canopy = MeshBuilder.CreateSphere('canopy', { segments: 8 }, scene)
  const trunk = MeshBuilder.CreateBox('trunk', { size: 0.5 }, scene)
  canopy.parent = root
  trunk.parent = root
  return { root, meshes: [canopy, trunk] }
}

describe('createPerfBench', () => {
  it('plants the dense forest and wires a profiler + HUD without a GL context', async () => {
    const canvas = document.createElement('canvas')
    const hudParent = document.createElement('div')

    const veg = await new Promise<InstancedVegetation>((resolve) => {
      const bench = createPerfBench(canvas, {
        createEngine: () => new NullEngine(),
        loadTree: (scene) => Promise.resolve(fakeTree(scene)),
        hudParent,
        onPlanted: (v) => {
          resolve(v)
          // Sampling once must produce a valid budget verdict.
          const report = bench.profiler.sample()
          expect(report.lines).toHaveLength(4)
          expect(hudParent.querySelector('[data-testid="perf-hud"]')).not.toBeNull()
          bench.dispose()
          // Dispose tears the HUD back out of the DOM.
          expect(hudParent.querySelector('[data-testid="perf-hud"]')).toBeNull()
        },
      })
    })

    // 24×24 grid of a 2-submesh tree → one batch per submesh.
    expect(veg.instanceCount).toBe(576)
    expect(veg.drawCalls).toBe(2)
  })
})
