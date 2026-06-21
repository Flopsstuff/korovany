import { NullEngine, Scene, TransformNode } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALACE_GUARD_GLB,
  HUMAN_LANDS_PALACE_GUARD_SPECS,
  spawnPalaceGuardProps,
} from './palaceGuardProp'

function makeScene() {
  const engine = new NullEngine()
  return new Scene(engine)
}

describe('spawnPalaceGuardProps', () => {
  it('exports the shipped palace-guard GLB path', () => {
    expect(DEFAULT_PALACE_GUARD_GLB).toBe('/models/empire-palace-guard.glb')
  })

  it('seeds two toll-gate flanking positions on Human Lands', () => {
    expect(HUMAN_LANDS_PALACE_GUARD_SPECS).toHaveLength(2)
    expect(HUMAN_LANDS_PALACE_GUARD_SPECS.map((s) => s.id)).toEqual([
      'palace-guard-toll-left',
      'palace-guard-toll-right',
    ])
  })

  it('creates one placement root per spec without fetching the GLB', () => {
    const scene = makeScene()
    const props = spawnPalaceGuardProps(scene, HUMAN_LANDS_PALACE_GUARD_SPECS, null)

    expect(props).toHaveLength(2)
    props.forEach((prop, index) => {
      const spec = HUMAN_LANDS_PALACE_GUARD_SPECS[index]
      expect(prop.root).toBeInstanceOf(TransformNode)
      expect(prop.root.name).toBe(`palace-guard:${spec.id}`)
      expect(prop.root.position.x).toBeCloseTo(spec.position.x)
      expect(prop.root.position.z).toBeCloseTo(spec.position.z)
      expect(prop.root.rotation.y).toBeCloseTo(spec.yaw ?? 0)
    })

    props.forEach((p) => p.dispose())
    scene.dispose()
  })
})
