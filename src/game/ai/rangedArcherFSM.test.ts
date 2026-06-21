import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../combat'
import {
  applyDamageToArcher,
  createArcherFSM,
  DEFAULT_ARCHER_PARAMS,
  stepArcherFSM,
} from './rangedArcherFSM'

const at = (x: number, z: number): Vec3 => ({ x, y: 0, z })

describe('createArcherFSM', () => {
  it('starts on patrol at full health', () => {
    const s = createArcherFSM()
    expect(s.phase).toBe('patrol')
    expect(s.health.current).toBe(DEFAULT_ARCHER_PARAMS.maxHp)
  })
})

describe('stepArcherFSM — engage transitions', () => {
  it('patrols quietly while the player is out of detection range', () => {
    const s = createArcherFSM()
    const r = stepArcherFSM(s, at(0, 0), at(0, 40), 0.1)
    expect(r.state.phase).toBe('patrol')
    expect(r.fired).toBe(false)
  })

  it('engages once the player enters detection range', () => {
    const s = createArcherFSM()
    const r = stepArcherFSM(s, at(0, 0), at(0, 10), 0.1)
    expect(r.state.phase).toBe('engage')
  })

  it('de-aggros back to patrol when the player flees past the hysteresis band', () => {
    let s = createArcherFSM()
    s = stepArcherFSM(s, at(0, 0), at(0, 10), 0.1).state
    expect(s.phase).toBe('engage')
    const r = stepArcherFSM(s, at(0, 0), at(0, 30), 0.1)
    expect(r.state.phase).toBe('patrol')
  })
})

describe('stepArcherFSM — firing', () => {
  it('looses an arrow when engaged, in range, off cooldown, with a clear shot', () => {
    const s = createArcherFSM()
    s.phase = 'engage'
    const r = stepArcherFSM(s, at(0, 0), at(0, 8), 0.1, DEFAULT_ARCHER_PARAMS, {
      hasLineOfSight: true,
    })
    expect(r.fired).toBe(true)
    expect(r.state.attackCooldown).toBeCloseTo(DEFAULT_ARCHER_PARAMS.attackCooldown)
    // Aims straight at the player (down +z here).
    expect(r.aimDirZ).toBeCloseTo(1)
  })

  it('holds fire without a clear line of sight and repositions to regain it', () => {
    const s = createArcherFSM()
    s.phase = 'engage'
    const r = stepArcherFSM(s, at(0, 0), at(0, 8), 0.1, DEFAULT_ARCHER_PARAMS, {
      hasLineOfSight: false,
    })
    expect(r.fired).toBe(false)
    expect(r.moveDZ).toBeGreaterThan(0) // edges toward the player to clear the shot
  })

  it('respects the cooldown between shots', () => {
    let s = createArcherFSM()
    s.phase = 'engage'
    const first = stepArcherFSM(s, at(0, 0), at(0, 8), 0.1)
    expect(first.fired).toBe(true)
    s = first.state
    const second = stepArcherFSM(s, at(0, 0), at(0, 8), 0.1)
    expect(second.fired).toBe(false) // still on cooldown
  })

  it('does not fire beyond engage range even while detected', () => {
    const s = createArcherFSM()
    s.phase = 'engage'
    // 13 m: inside detection (15) but outside engage (12).
    const r = stepArcherFSM(s, at(0, 0), at(0, 13), 0.1)
    expect(r.fired).toBe(false)
    expect(r.moveDZ).toBeGreaterThan(0) // closes the gap instead
  })
})

describe('stepArcherFSM — standoff kiting', () => {
  it('back-pedals when the player crowds inside minRange', () => {
    const s = createArcherFSM()
    s.phase = 'engage'
    const r = stepArcherFSM(s, at(0, 0), at(0, 3), 0.1) // 3 m < minRange (5)
    expect(r.moveDZ).toBeLessThan(0) // moves away from the player (−z)
  })

  it('holds position at the preferred standoff distance', () => {
    const s = createArcherFSM()
    s.phase = 'engage'
    const r = stepArcherFSM(s, at(0, 0), at(0, 7), 0.1) // between min(5) and preferred(8)
    expect(Math.abs(r.moveDX) + Math.abs(r.moveDZ)).toBeCloseTo(0)
  })
})

describe('applyDamageToArcher', () => {
  it('reduces health and kills at zero HP', () => {
    let s = createArcherFSM()
    s = applyDamageToArcher(s, 10)
    expect(s.health.current).toBe(DEFAULT_ARCHER_PARAMS.maxHp - 10)
    expect(s.phase).toBe('patrol')
    s = applyDamageToArcher(s, DEFAULT_ARCHER_PARAMS.maxHp)
    expect(s.phase).toBe('dead')
  })

  it('a dead archer is inert — no movement, no firing', () => {
    let s = createArcherFSM()
    s = applyDamageToArcher(s, DEFAULT_ARCHER_PARAMS.maxHp)
    const r = stepArcherFSM(s, at(0, 0), at(0, 5), 0.1)
    expect(r.fired).toBe(false)
    expect(r.moveDX).toBe(0)
    expect(r.moveDZ).toBe(0)
  })
})

describe('stepArcherFSM — patrol leash (FLO-412 parity)', () => {
  it('steers back toward its anchor once it wanders past the leash', () => {
    const s = createArcherFSM()
    const anchor = at(0, 0)
    // Archer well past its 6 m leash at +x; expect it to head back toward −x.
    const r = stepArcherFSM(s, at(10, 0), at(0, 40), 0.1, DEFAULT_ARCHER_PARAMS, {
      anchorPos: anchor,
    })
    expect(r.moveDX).toBeLessThan(0)
  })
})
