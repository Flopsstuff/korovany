import { describe, expect, it } from 'vitest'
import {
  gameReducer,
  KILL_SCORE,
  OBJECTIVE_CARAVAN_TARGET,
  raidCaravan,
  recordKill,
  resetRun,
  type GameState,
} from './gameSlice'

const freshRun = (): GameState =>
  gameReducer(undefined, { type: '@@INIT' })

describe('gameSlice', () => {
  it('starts a run with zero progress and the caravan objective', () => {
    const state = freshRun()
    expect(state.kills).toBe(0)
    expect(state.caravansRaided).toBe(0)
    expect(state.score).toBe(0)
    expect(state.objectiveTarget).toBe(OBJECTIVE_CARAVAN_TARGET)
  })

  it('records a kill and awards kill points', () => {
    const state = gameReducer(freshRun(), recordKill())
    expect(state.kills).toBe(1)
    expect(state.score).toBe(KILL_SCORE)
  })

  it('advances the raid objective and scores the haul', () => {
    let state = gameReducer(freshRun(), raidCaravan(7))
    expect(state.caravansRaided).toBe(1)
    expect(state.score).toBe(7)
    state = gameReducer(state, raidCaravan(3))
    expect(state.caravansRaided).toBe(2)
    expect(state.score).toBe(10)
  })

  it('accumulates kills and raids into one score', () => {
    let state = gameReducer(freshRun(), recordKill())
    state = gameReducer(state, raidCaravan(5))
    expect(state.score).toBe(KILL_SCORE + 5)
  })

  it('resets all run state for a fresh game', () => {
    const dirty: GameState = { kills: 4, caravansRaided: 2, objectiveTarget: 3, score: 99 }
    expect(gameReducer(dirty, resetRun())).toEqual(freshRun())
  })
})
