import { describe, expect, it } from 'vitest'
import { evaluateOutcome } from './objectiveMachine'

describe('evaluateOutcome (win/lose state machine)', () => {
  it('stays playing while the objective is unmet and the player is alive', () => {
    expect(evaluateOutcome({ caravansRaided: 0, target: 3, playerDead: false })).toBe('playing')
    expect(evaluateOutcome({ caravansRaided: 2, target: 3, playerDead: false })).toBe('playing')
  })

  it('wins exactly when the raided count reaches the target', () => {
    expect(evaluateOutcome({ caravansRaided: 3, target: 3, playerDead: false })).toBe('won')
  })

  it('wins when the raided count exceeds the target', () => {
    expect(evaluateOutcome({ caravansRaided: 5, target: 3, playerDead: false })).toBe('won')
  })

  it('loses when the player is dead, objective incomplete', () => {
    expect(evaluateOutcome({ caravansRaided: 1, target: 3, playerDead: true })).toBe('lost')
  })

  it('death takes priority over a completed objective', () => {
    // A degenerate input (won AND dead at once) resolves to lost — the function
    // is total and unambiguous even though the live game freezes on win first.
    expect(evaluateOutcome({ caravansRaided: 3, target: 3, playerDead: true })).toBe('lost')
  })

  it('a zero target is won immediately while alive', () => {
    expect(evaluateOutcome({ caravansRaided: 0, target: 0, playerDead: false })).toBe('won')
  })
})
