import { NullEngine, Scene, TransformNode } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { getZoneContent } from '../game/world'
import {
  DEFAULT_TOLL_GATE_GLB,
  TOLL_GATE_TARGET_SIZE,
  spawnTollGateProp,
} from './tollGateProp'

function makeScene() {
  const engine = new NullEngine()
  return new Scene(engine)
}

describe('spawnTollGateProp', () => {
  it('exports the shipped toll-gate GLB path and landmark scale', () => {
    expect(DEFAULT_TOLL_GATE_GLB).toBe('/models/toll-gate.glb')
    expect(TOLL_GATE_TARGET_SIZE).toBe(2)
  })

  it('places the root at the zone-content toll-gate landmark without fetching the GLB', () => {
    const landmark = getZoneContent('human-lands').landmarks.find((lm) => lm.id === 'toll-gate')
    expect(landmark).toBeDefined()

    const scene = makeScene()
    const prop = spawnTollGateProp(scene, null)

    expect(prop.root).toBeInstanceOf(TransformNode)
    expect(prop.root.name).toBe('landmark:toll-gate')
    expect(prop.root.position.x).toBeCloseTo(landmark!.position.x)
    expect(prop.root.position.z).toBeCloseTo(landmark!.position.z)
    expect(prop.root.position.y).toBe(0)

    prop.dispose()
    scene.dispose()
  })
})
