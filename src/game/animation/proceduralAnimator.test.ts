import { describe, expect, it } from 'vitest'
import {
  CharacterAnimator,
  createAnimatorState,
  stepAnimator,
  type AnimatableNode,
} from './proceduralAnimator'

describe('stepAnimator — locomotion modes (E6.1.5)', () => {
  it('lowers the visual and leans forward while crawling', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.016,
      speed: 2,
      attackPhase: 'idle',
      isDead: false,
      locomotionMode: 'crawl',
    })
    expect(output.offsetY).toBeLessThan(0)
    expect(output.leanX).toBeGreaterThan(0.3)
  })

  it('uses a seated offset while in a wheelchair', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.016,
      speed: 2,
      attackPhase: 'idle',
      isDead: false,
      locomotionMode: 'wheelchair',
    })
    expect(output.offsetY).toBeLessThan(0)
    expect(output.leanX).toBeLessThan(0)
  })
})

describe('stepAnimator — idle', () => {
  it('produces zero bob at t=0', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, { dt: 0, speed: 0, attackPhase: 'idle', isDead: false })
    expect(output.bobY).toBe(0)
    expect(output.leanX).toBe(0)
    expect(output.lungeZ).toBe(0)
    expect(output.toppleZ).toBe(0)
  })

  it('returns positive bob at quarter period for idle freq', () => {
    const state = createAnimatorState()
    // Quarter period: dt = 1/(4*1.1) ≈ 0.2273 s → sin should be ~1
    const quarterPeriod = 1 / (4 * 1.1)
    const { output } = stepAnimator(state, {
      dt: quarterPeriod,
      speed: 0,
      attackPhase: 'idle',
      isDead: false,
    })
    // sin(π/2) = 1; amplitude 0.025 → ~0.025
    expect(output.bobY).toBeCloseTo(0.025, 2)
  })

  it('produces no lean while stationary', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, { dt: 0.1, speed: 0, attackPhase: 'idle', isDead: false })
    expect(output.leanX).toBe(0)
  })
})

describe('stepAnimator — moving', () => {
  it('increases bob amplitude when speed > 0.05', () => {
    const state = createAnimatorState()
    // quarter period of MOVE_BOB_FREQ=2.4 Hz
    const quarterPeriod = 1 / (4 * 2.4)
    const { output } = stepAnimator(state, {
      dt: quarterPeriod,
      speed: 4,
      attackPhase: 'idle',
      isDead: false,
    })
    // amplitude 0.055 at speed=4 (full lean cap)
    expect(output.bobY).toBeCloseTo(0.055, 2)
  })

  it('selects the deeper sprint-tier bob above the sprint speed (FLO-465)', () => {
    // Quarter period of SPRINT_BOB_FREQ=3.4 Hz → sin peak, so bobY ≈ amplitude.
    const sprintQuarter = 1 / (4 * 3.4)
    const { output: sprint } = stepAnimator(createAnimatorState(), {
      dt: sprintQuarter,
      speed: 9, // > 7.5 sprint threshold
      attackPhase: 'idle',
      isDead: false,
    })
    // Sprint amplitude 0.085, deeper than the move tier's 0.055.
    expect(sprint.bobY).toBeCloseTo(0.085, 2)

    // A walking speed stays on the shallower move tier.
    const moveQuarter = 1 / (4 * 2.4)
    const { output: move } = stepAnimator(createAnimatorState(), {
      dt: moveQuarter,
      speed: 4, // walk: > 0.05 but < 7.5
      attackPhase: 'idle',
      isDead: false,
    })
    expect(move.bobY).toBeCloseTo(0.055, 2)
    // Sprint peak is strictly deeper than the move peak.
    expect(sprint.bobY).toBeGreaterThan(move.bobY)
  })

  it('produces lean proportional to speed up to max', () => {
    const state = createAnimatorState()
    const { output: slowOut } = stepAnimator(state, {
      dt: 0.016,
      speed: 2,
      attackPhase: 'idle',
      isDead: false,
    })
    const { output: fastOut } = stepAnimator(state, {
      dt: 0.016,
      speed: 8,
      attackPhase: 'idle',
      isDead: false,
    })
    // faster → more lean, both > 0
    expect(slowOut.leanX).toBeGreaterThan(0)
    expect(fastOut.leanX).toBeGreaterThanOrEqual(slowOut.leanX)
  })
})

describe('stepAnimator — attack lunge', () => {
  it('pulls back slightly during windup', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'windup',
      isDead: false,
    })
    expect(output.lungeZ).toBeLessThan(0)
  })

  it('lunges forward during active window', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'active',
      isDead: false,
    })
    expect(output.lungeZ).toBeGreaterThan(0)
  })

  it('partially extends during recovery', () => {
    const state = createAnimatorState()
    const { output: active } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'active',
      isDead: false,
    })
    const { output: recovery } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'recovery',
      isDead: false,
    })
    expect(recovery.lungeZ).toBeGreaterThan(0)
    expect(recovery.lungeZ).toBeLessThan(active.lungeZ)
  })

  it('returns no lunge when idle phase', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'idle',
      isDead: false,
    })
    expect(output.lungeZ).toBe(0)
  })
})

describe('stepAnimator — death topple', () => {
  it('produces no topple when alive', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.1,
      speed: 0,
      attackPhase: 'idle',
      isDead: false,
    })
    expect(output.toppleZ).toBe(0)
  })

  it('starts toppling immediately on death', () => {
    const state = createAnimatorState()
    const { output } = stepAnimator(state, {
      dt: 0.05,
      speed: 0,
      attackPhase: 'idle',
      isDead: true,
    })
    expect(output.toppleZ).toBeGreaterThan(0)
  })

  it('reaches π/2 after sufficient time dead', () => {
    let state = createAnimatorState()
    for (let i = 0; i < 60; i++) {
      const { state: next } = stepAnimator(state, {
        dt: 1 / 60,
        speed: 0,
        attackPhase: 'idle',
        isDead: true,
      })
      state = next
    }
    const { output } = stepAnimator(state, {
      dt: 1 / 60,
      speed: 0,
      attackPhase: 'idle',
      isDead: true,
    })
    expect(output.toppleZ).toBeCloseTo(Math.PI / 2, 2)
  })

  it('clamps topple at π/2 — does not overshoot', () => {
    let state = createAnimatorState()
    for (let i = 0; i < 200; i++) {
      const { state: next } = stepAnimator(state, {
        dt: 1 / 60,
        speed: 0,
        attackPhase: 'idle',
        isDead: true,
      })
      state = next
    }
    const { output } = stepAnimator(state, {
      dt: 1 / 60,
      speed: 0,
      attackPhase: 'idle',
      isDead: true,
    })
    expect(output.toppleZ).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
  })
})

describe('stepAnimator — state accumulation', () => {
  it('advances time each tick', () => {
    const s0 = createAnimatorState()
    const { state: s1 } = stepAnimator(s0, { dt: 0.1, speed: 0, attackPhase: 'idle', isDead: false })
    const { state: s2 } = stepAnimator(s1, { dt: 0.1, speed: 0, attackPhase: 'idle', isDead: false })
    expect(s2.time).toBeCloseTo(0.2, 5)
  })

  it('resets topple progress when character revives (isDead=false)', () => {
    let state = createAnimatorState()
    for (let i = 0; i < 10; i++) {
      const r = stepAnimator(state, { dt: 0.1, speed: 0, attackPhase: 'idle', isDead: true })
      state = r.state
    }
    expect(state.toppleProgress).toBeGreaterThan(0)
    const { state: revived } = stepAnimator(state, {
      dt: 0.016,
      speed: 0,
      attackPhase: 'idle',
      isDead: false,
    })
    expect(revived.toppleProgress).toBe(0)
  })
})

describe('CharacterAnimator', () => {
  function makeNode(): AnimatableNode {
    return { position: { y: 0, z: 0 }, rotation: { x: 0, z: 0 } }
  }

  it('does nothing when node is null', () => {
    const animator = new CharacterAnimator()
    // Should not throw
    animator.update({ dt: 0.016, speed: 0, attackPhase: 'idle', isDead: false })
  })

  it('applies bob to node.position.y relative to baseY', () => {
    const animator = new CharacterAnimator(-0.9, 0)
    const node = makeNode()
    node.position.y = -0.9
    animator.node = node
    // advance to near quarter-period (positive peak)
    const quarterPeriod = 1 / (4 * 1.1)
    animator.update({ dt: quarterPeriod, speed: 0, attackPhase: 'idle', isDead: false })
    // position.y should be baseY + ~0.025
    expect(node.position.y).toBeGreaterThan(-0.9)
  })

  it('applies topple Z rotation on death', () => {
    const animator = new CharacterAnimator()
    const node = makeNode()
    animator.node = node
    for (let i = 0; i < 30; i++) {
      animator.update({ dt: 1 / 60, speed: 0, attackPhase: 'idle', isDead: true })
    }
    expect(node.rotation.z).toBeGreaterThan(0)
  })
})
