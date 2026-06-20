import { describe, expect, it } from 'vitest'
import {
  appReducer,
  continueGame,
  returnToMenu,
  startNewGame,
  togglePause,
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

  it('keeps continue as a menu stub for this phase', () => {
    const state: AppState = { phase: 'menu' }
    expect(appReducer(state, continueGame()).phase).toBe('menu')
  })

  it('toggles pause only between playing and paused', () => {
    expect(appReducer({ phase: 'playing' }, togglePause()).phase).toBe('paused')
    expect(appReducer({ phase: 'paused' }, togglePause()).phase).toBe('playing')
    expect(appReducer({ phase: 'menu' }, togglePause()).phase).toBe('menu')
  })

  it('can return to the menu', () => {
    expect(appReducer({ phase: 'paused' }, returnToMenu()).phase).toBe('menu')
  })
})
