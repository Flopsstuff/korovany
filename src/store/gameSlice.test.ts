import { describe, expect, it } from 'vitest'
import { addScore, gameReducer, resetScore, type GameState } from './gameSlice'

describe('gameSlice', () => {
  it('starts with a zero score', () => {
    const state = gameReducer(undefined, { type: '@@INIT' })
    expect(state.score).toBe(0)
  })

  it('adds to the score', () => {
    const start: GameState = { score: 0 }
    expect(gameReducer(start, addScore(5)).score).toBe(5)
    expect(gameReducer({ score: 5 }, addScore(3)).score).toBe(8)
  })

  it('resets the score', () => {
    expect(gameReducer({ score: 42 }, resetScore()).score).toBe(0)
  })
})
