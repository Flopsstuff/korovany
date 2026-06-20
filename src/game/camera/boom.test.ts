import { describe, expect, it } from 'vitest'
import {
  type CameraParams,
  DEFAULT_CAMERA_PARAMS,
  applyLook,
  clampBoomRadius,
} from './boom'

const PARAMS: CameraParams = {
  yawSensitivity: 0.01,
  pitchSensitivity: 0.01,
  minPitch: 0.3,
  maxPitch: 1.4,
  distance: 6,
  collisionMargin: 0.3,
}

describe('applyLook', () => {
  it('orbits yaw opposite to horizontal mouse movement', () => {
    const next = applyLook({ alpha: 0, beta: 1 }, 100, 0, PARAMS)
    expect(next.alpha).toBeCloseTo(-1, 6) // 0 - 100*0.01
    expect(next.beta).toBe(1)
  })

  it('changes pitch with vertical mouse movement', () => {
    const next = applyLook({ alpha: 0, beta: 1 }, 0, 20, PARAMS)
    expect(next.beta).toBeCloseTo(1.2, 6)
  })

  it('clamps pitch to the configured min/max', () => {
    const high = applyLook({ alpha: 0, beta: 1 }, 0, 10_000, PARAMS)
    expect(high.beta).toBe(PARAMS.maxPitch)
    const low = applyLook({ alpha: 0, beta: 1 }, 0, -10_000, PARAMS)
    expect(low.beta).toBe(PARAMS.minPitch)
  })
})

describe('clampBoomRadius', () => {
  it('keeps the full desired distance when nothing occludes', () => {
    expect(clampBoomRadius(null, PARAMS)).toBe(PARAMS.distance)
  })

  it('pulls the camera in to just before an occluder', () => {
    expect(clampBoomRadius(4, PARAMS)).toBeCloseTo(4 - PARAMS.collisionMargin, 6)
  })

  it('never exceeds the desired distance even if the hit is farther', () => {
    expect(clampBoomRadius(100, PARAMS)).toBe(PARAMS.distance)
  })

  it('never goes negative for a very close occluder', () => {
    expect(clampBoomRadius(0.1, PARAMS)).toBe(0)
  })
})

describe('DEFAULT_CAMERA_PARAMS', () => {
  it('has a sane pitch range and positive distance', () => {
    expect(DEFAULT_CAMERA_PARAMS.minPitch).toBeLessThan(DEFAULT_CAMERA_PARAMS.maxPitch)
    expect(DEFAULT_CAMERA_PARAMS.maxPitch).toBeLessThan(Math.PI)
    expect(DEFAULT_CAMERA_PARAMS.distance).toBeGreaterThan(0)
  })
})
