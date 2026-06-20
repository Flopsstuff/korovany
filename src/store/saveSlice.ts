import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SavePayload } from '../game/save'

export interface SaveState {
  /** Whether an autosave slot exists (checked on mount). */
  hasSave: boolean
  /** The last successfully loaded save, for restoring player state. */
  loadedSave: SavePayload | null
}

const initialState: SaveState = { hasSave: false, loadedSave: null }

const saveSlice = createSlice({
  name: 'save',
  initialState,
  reducers: {
    setSaveExists(state, action: PayloadAction<boolean>) {
      state.hasSave = action.payload
    },
    setSaveLoaded(state, action: PayloadAction<SavePayload | null>) {
      state.loadedSave = action.payload
    },
  },
})

export const { setSaveExists, setSaveLoaded } = saveSlice.actions
export const saveReducer = saveSlice.reducer
