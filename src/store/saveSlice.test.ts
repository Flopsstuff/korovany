import { describe, expect, it } from 'vitest'
import { saveReducer, setSaveExists, setSaveLoaded } from './saveSlice'
import type { SavePayload } from '../game/save'

const SAMPLE: SavePayload = {
  zoneId: 'forest',
  playerPos: { x: 0, y: 0, z: 0 },
  score: 10,
  savedAt: 0,
}

describe('saveSlice', () => {
  it('boots with no save and no loaded payload', () => {
    const state = saveReducer(undefined, { type: '@@INIT' })
    expect(state.hasSave).toBe(false)
    expect(state.loadedSave).toBeNull()
  })

  it('records that a save slot exists', () => {
    const state = saveReducer({ hasSave: false, loadedSave: null }, setSaveExists(true))
    expect(state.hasSave).toBe(true)
  })

  it('stores the loaded save payload', () => {
    const state = saveReducer({ hasSave: true, loadedSave: null }, setSaveLoaded(SAMPLE))
    expect(state.loadedSave).toEqual(SAMPLE)
  })

  it('clears the loaded save on null', () => {
    const state = saveReducer({ hasSave: true, loadedSave: SAMPLE }, setSaveLoaded(null))
    expect(state.loadedSave).toBeNull()
  })
})
