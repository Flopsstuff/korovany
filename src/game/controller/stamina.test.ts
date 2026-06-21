import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STAMINA_PARAMS,
  type StaminaState,
  createStaminaState,
  stepStamina,
} from './stamina'

const DT = 1 / 60
const P = DEFAULT_STAMINA_PARAMS

/** Drive `stepStamina` for `steps` ticks at fixed dt with a constant intent. */
function run(state: StaminaState, intent: boolean, steps: number): StaminaState {
  let s: StaminaState = state
  for (let i = 0; i < steps; i++) s = stepStamina(s, intent, DT)
  return s
}

describe('createStaminaState', () => {
  it('starts full, not exhausted, with no regen delay', () => {
    const s = createStaminaState()
    expect(s.stamina).toBe(P.max)
    expect(s.exhausted).toBe(false)
    expect(s.regenCountdown).toBe(0)
  })
})

describe('stepStamina — drain', () => {
  it('drains at drainRate while sprinting', () => {
    const next = stepStamina(createStaminaState(), true, DT)
    expect(next.stamina).toBeCloseTo(P.max - P.drainRate * DT, 6)
    expect(next.sprintActive).toBe(true)
  })

  it('drains to 0 in ~max/drainRate seconds and sets exhausted', () => {
    // 100 / 25 = 4 s → 240 steps at 60 fps; run a touch longer to be safe.
    const s = run(createStaminaState(), true, 260)
    expect(s.stamina).toBe(0)
    expect(s.exhausted).toBe(true)
  })

  it('flips sprintActive false once the pool hits 0', () => {
    // Hold sprint through depletion; the step *after* empty must report inactive.
    const empty = run(createStaminaState(), true, 260)
    const next = stepStamina(empty, true, DT)
    expect(next.sprintActive).toBe(false)
    expect(next.stamina).toBe(0)
  })
})

describe('stepStamina — regen', () => {
  it('does not regen during the idle delay window', () => {
    // One sprint step arms the 0.5 s delay; releasing immediately must not regen.
    const sprinted = stepStamina(createStaminaState({ ...P, max: 50 }), true, DT)
    const released = stepStamina(sprinted, false, DT, { ...P, max: 50 })
    expect(released.stamina).toBeLessThanOrEqual(sprinted.stamina)
    expect(released.regenCountdown).toBeGreaterThan(0)
  })

  it('regens at regenRate after the idle delay elapses', () => {
    // Spend some stamina, then idle past the delay and accumulate regen.
    const spent = run(createStaminaState(), true, 60) // ~0.75 s of drain
    const before = spent.stamina
    // Idle long enough to clear the 0.5 s delay and regen for a while.
    const regened = run(spent, false, 120) // 2 s idle
    expect(regened.stamina).toBeGreaterThan(before)
  })

  it('caps regen at max', () => {
    const nearFull = run(createStaminaState(), true, 6) // tiny drain
    const regened = run(nearFull, false, 600) // 10 s idle — plenty to refill
    expect(regened.stamina).toBe(P.max)
  })
})

describe('stepStamina — hysteresis', () => {
  it('keeps sprint locked out at 0 until regen passes the re-enable threshold', () => {
    const empty = run(createStaminaState(), true, 260)
    expect(empty.exhausted).toBe(true)

    // Even holding sprint, an exhausted pool yields no sprint and starts to heal.
    const held = stepStamina(empty, true, DT)
    expect(held.sprintActive).toBe(false)

    // Idle until stamina climbs above the threshold; lock-out lifts.
    const s = run(held, false, 200)
    expect(s.stamina).toBeGreaterThan(P.reEnableThreshold)
    expect(s.exhausted).toBe(false)

    // With the lock-out cleared, sprint engages again.
    const reSprint = stepStamina(s, true, DT)
    expect(reSprint.sprintActive).toBe(true)
  })

  it('stays exhausted while regen is still below the threshold', () => {
    const empty = run(createStaminaState(), true, 260)
    // Clear the 0.5 s delay but stop well before reaching the 15 threshold.
    const barely = run(empty, false, 40) // ~0.67 s: ~0.17 s of regen ≈ 2.5 units
    expect(barely.stamina).toBeLessThan(P.reEnableThreshold)
    expect(barely.exhausted).toBe(true)
    expect(stepStamina(barely, true, DT).sprintActive).toBe(false)
  })
})
