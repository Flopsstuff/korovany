import { describe, expect, it } from 'vitest'
import {
  appReducer,
  continueGame,
  loseGame,
  returnToMenu,
  startNewGame,
  togglePause,
  winGame,
  type AppState,
} from './appSlice'

describe('appSlice', () => {
  it('boots into the main menu', () => {
    const state = appReducer(undefined, { type: '@@INIT' })
    expect(state.phase).toBe('menu')
  })

  it('starts a new game from the menu', () => {
    const state: AppState = { phase: 'menu' }
    expect(appReducer(state, startNewGame()).phase).toBe('playing')
  })

  it('continues into the game from the menu (resume a save)', () => {
    const state: AppState = { phase: 'menu' }
    expect(appReducer(state, continueGame()).phase).toBe('playing')
  })

  it('toggles pause only between playing and paused', () => {
    expect(appReducer({ phase: 'playing' }, togglePause()).phase).toBe('paused')
    expect(appReducer({ phase: 'paused' }, togglePause()).phase).toBe('playing')
    expect(appReducer({ phase: 'menu' }, togglePause()).phase).toBe('menu')
  })

  it('can return to the menu', () => {
    expect(appReducer({ phase: 'paused' }, returnToMenu()).phase).toBe('menu')
  })

  it('wins only from active play', () => {
    expect(appReducer({ phase: 'playing' }, winGame()).phase).toBe('won')
    expect(appReducer({ phase: 'paused' }, winGame()).phase).toBe('paused')
    expect(appReducer({ phase: 'menu' }, winGame()).phase).toBe('menu')
  })

  it('loses only from active play', () => {
    expect(appReducer({ phase: 'playing' }, loseGame()).phase).toBe('lost')
    expect(appReducer({ phase: 'paused' }, loseGame()).phase).toBe('paused')
    expect(appReducer({ phase: 'menu' }, loseGame()).phase).toBe('menu')
  })

  it('restarts from a win or loss back into play', () => {
    expect(appReducer({ phase: 'won' }, startNewGame()).phase).toBe('playing')
    expect(appReducer({ phase: 'lost' }, startNewGame()).phase).toBe('playing')
  })
})
