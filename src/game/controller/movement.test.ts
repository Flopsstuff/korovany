import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOVEMENT_PARAMS,
  type MovementInput,
  type MovementParams,
  createMovementState,
  stepMovement,
} from './movement'

const DT = 1 / 60

const PARAMS: MovementParams = {
  walkSpeed: 4,
  sprintSpeed: 8,
  gravity: 20,
  jumpSpeed: 9,
  coyoteTime: 0.1,
  capsuleHalfHeight: 1,
}

const IDLE: MovementInput = { dirX: 0, dirZ: 0, sprint: false, jump: false }

/** Resting on flat ground at y=0 → origin sits at capsuleHalfHeight. */
function grounded() {
  const feet = createMovementState(0, PARAMS.capsuleHalfHeight, 0)
  // One step of gravity + clamp settles `grounded`/`canJump`/`coyote`.
  return stepMovement(feet, IDLE, 0, PARAMS, DT)
}

describe('stepMovement — horizontal locomotion', () => {
  it('walks at walkSpeed along the world move direction', () => {
    const next = stepMovement(grounded(), { ...IDLE, dirX: 1 }, 0, PARAMS, DT)
    expect(next.posX).toBeCloseTo(PARAMS.walkSpeed * DT, 6)
    expect(next.posZ).toBe(0)
  })

  it('sprints faster when sprint is held', () => {
    const next = stepMovement(grounded(), { ...IDLE, dirZ: 1, sprint: true }, 0, PARAMS, DT)
    expect(next.posZ).toBeCloseTo(PARAMS.sprintSpeed * DT, 6)
  })

  it('leaves horizontal position unchanged with no move input', () => {
    const next = stepMovement(grounded(), IDLE, 0, PARAMS, DT)
    expect(next.posX).toBe(0)
    expect(next.posZ).toBe(0)
  })
})

describe('stepMovement — gravity & ground clamp', () => {
  it('accelerates downward when airborne with no ground below', () => {
    const start = createMovementState(0, 10, 0)
    const a = stepMovement(start, IDLE, null, PARAMS, DT)
    expect(a.velY).toBeCloseTo(-PARAMS.gravity * DT, 6)
    expect(a.posY).toBeLessThan(10)
    expect(a.grounded).toBe(false)

    const b = stepMovement(a, IDLE, null, PARAMS, DT)
    expect(b.velY).toBeCloseTo(-PARAMS.gravity * DT * 2, 6)
  })

  it('clamps to rest on the ground and zeroes vertical velocity', () => {
    // Falling fast, one step below the clamp line.
    const falling = { ...createMovementState(0, PARAMS.capsuleHalfHeight + 0.01, 0), velY: -5 }
    const next = stepMovement(falling, IDLE, 0, PARAMS, DT)
    expect(next.posY).toBeCloseTo(PARAMS.capsuleHalfHeight, 6)
    expect(next.velY).toBe(0)
    expect(next.grounded).toBe(true)
  })

  it('clamps to a raised ground height (origin = groundHeight + halfHeight)', () => {
    const g = 3
    const falling = { ...createMovementState(0, g + PARAMS.capsuleHalfHeight - 0.5, 0), velY: -2 }
    const next = stepMovement(falling, IDLE, g, PARAMS, DT)
    expect(next.posY).toBeCloseTo(g + PARAMS.capsuleHalfHeight, 6)
    expect(next.grounded).toBe(true)
  })

  it('does not clamp while ascending through the ground plane (jump arc intact)', () => {
    const rising = { ...createMovementState(0, PARAMS.capsuleHalfHeight, 0), velY: 5 }
    const next = stepMovement(rising, IDLE, 0, PARAMS, DT)
    expect(next.grounded).toBe(false)
    expect(next.posY).toBeGreaterThan(PARAMS.capsuleHalfHeight)
  })
})

describe('stepMovement — jump', () => {
  it('jumps from the ground on the rising edge of the jump input', () => {
    const next = stepMovement(grounded(), { ...IDLE, jump: true }, 0, PARAMS, DT)
    // Initial jump velocity minus one step of gravity.
    expect(next.velY).toBeCloseTo(PARAMS.jumpSpeed - PARAMS.gravity * DT, 6)
    expect(next.grounded).toBe(false)
    expect(next.canJump).toBe(false)
  })

  it('does not re-trigger while jump stays held (edge-triggered, no auto-bhop)', () => {
    const jumped = stepMovement(grounded(), { ...IDLE, jump: true }, 0, PARAMS, DT)
    // Still holding jump on the next airborne step: must not refresh velocity.
    const held = stepMovement(jumped, { ...IDLE, jump: true }, null, PARAMS, DT)
    expect(held.velY).toBeLessThan(jumped.velY)
  })

  it('forbids a double jump in mid-air', () => {
    let s = stepMovement(grounded(), { ...IDLE, jump: true }, null, PARAMS, DT) // first jump
    // Release then re-press jump while airborne.
    s = stepMovement(s, { ...IDLE, jump: false }, null, PARAMS, DT)
    const before = s.velY
    s = stepMovement(s, { ...IDLE, jump: true }, null, PARAMS, DT) // attempted 2nd jump
    expect(s.velY).toBeLessThan(before) // only gravity applied, no jump impulse
    expect(s.velY).not.toBeCloseTo(PARAMS.jumpSpeed - PARAMS.gravity * DT, 3)
  })

  it('allows another jump only after landing again', () => {
    let s = stepMovement(grounded(), { ...IDLE, jump: true }, null, PARAMS, DT)
    s = stepMovement(s, IDLE, null, PARAMS, DT)
    // Land: provide ground at 0 with a downward velocity.
    s = { ...s, posY: PARAMS.capsuleHalfHeight - 0.01, velY: -3 }
    s = stepMovement(s, IDLE, 0, PARAMS, DT)
    expect(s.grounded).toBe(true)
    expect(s.canJump).toBe(true)
    const again = stepMovement(s, { ...IDLE, jump: true }, 0, PARAMS, DT)
    expect(again.velY).toBeCloseTo(PARAMS.jumpSpeed - PARAMS.gravity * DT, 6)
  })
})

describe('stepMovement — coyote-time', () => {
  it('starts the grace window full on the first airborne step after a ledge', () => {
    const off = stepMovement(grounded(), IDLE, null, PARAMS, DT)
    expect(off.grounded).toBe(false)
    expect(off.coyoteRemaining).toBeCloseTo(PARAMS.coyoteTime - DT, 6)
  })

  it('still allows a jump within the coyote window after leaving ground', () => {
    const off = stepMovement(grounded(), IDLE, null, PARAMS, DT)
    expect(off.coyoteRemaining).toBeGreaterThan(0)
    const jumped = stepMovement(off, { ...IDLE, jump: true }, null, PARAMS, DT)
    expect(jumped.velY).toBeCloseTo(PARAMS.jumpSpeed - PARAMS.gravity * DT, 6)
    expect(jumped.canJump).toBe(false)
  })

  it('refuses a jump once the coyote window has elapsed', () => {
    // Walk off and coast (no jump) until coyote expires.
    let s = stepMovement(grounded(), IDLE, null, PARAMS, DT)
    while (s.coyoteRemaining > 0) {
      s = stepMovement(s, IDLE, null, PARAMS, DT)
    }
    expect(s.coyoteRemaining).toBe(0)
    const before = s.velY
    const tooLate = stepMovement(s, { ...IDLE, jump: true }, null, PARAMS, DT)
    expect(tooLate.velY).toBeLessThan(before) // gravity only — jump refused
  })

  it('refills the coyote window each grounded step', () => {
    const g = grounded()
    expect(g.grounded).toBe(true)
    expect(g.coyoteRemaining).toBeCloseTo(PARAMS.coyoteTime, 6)
  })
})

describe('DEFAULT_MOVEMENT_PARAMS', () => {
  it('is internally consistent (sprint faster than walk, positive gravity/jump)', () => {
    expect(DEFAULT_MOVEMENT_PARAMS.sprintSpeed).toBeGreaterThan(DEFAULT_MOVEMENT_PARAMS.walkSpeed)
    expect(DEFAULT_MOVEMENT_PARAMS.gravity).toBeGreaterThan(0)
    expect(DEFAULT_MOVEMENT_PARAMS.jumpSpeed).toBeGreaterThan(0)
    expect(DEFAULT_MOVEMENT_PARAMS.coyoteTime).toBeGreaterThan(0)
  })

  it('sprints at 9 units/s — 2.25× walk for a clearly faster sprint (FLO-465)', () => {
    expect(DEFAULT_MOVEMENT_PARAMS.sprintSpeed).toBe(9)
    expect(DEFAULT_MOVEMENT_PARAMS.walkSpeed).toBe(4)
  })
})
