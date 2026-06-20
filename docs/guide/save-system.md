# Save system (IndexedDB)

The save system (E1.4) persists player progress to the browser's IndexedDB
database — no backend, fully serverless. The implementation lives in
`src/game/save/`.

## Design

| Concern | Where |
| ------- | ----- |
| Read/write/delete slots | `src/game/save/saveStore.ts` |
| Slot key constants | `src/game/save/slots.ts` (`AUTOSAVE_SLOT`) |
| Save/load state in Redux | `src/store/saveSlice.ts` |
| Autosave trigger | `src/app/App.tsx` — fires on every `paused` phase transition |
| Continue button | `src/app/App.tsx` — appears only when `state.save.hasSave` is `true` |

## API

```ts
import { writeSave, readSave, deleteSave, hasSave, AUTOSAVE_SLOT } from '../game/save'

// Save to the autosave slot
await writeSave(AUTOSAVE_SLOT, {
  zoneId: 'forest',
  playerPos: { x: 0, y: 0, z: 0 },
  score: 42,
  savedAt: Date.now(),
})

// Read back
const save = await readSave(AUTOSAVE_SLOT)  // SavePayload | null

// Check existence (cheap — no deserialization)
const exists = await hasSave(AUTOSAVE_SLOT) // boolean
```

### `SavePayload`

```ts
interface SavePayload {
  zoneId: string          // zone the player was in
  playerPos: PlayerPos    // { x, y, z } in scene units
  score: number           // player score
  savedAt: number         // ms since epoch
}
```

## Slots

The system supports named slots (`AUTOSAVE_SLOT = 'autosave'`, or any string).
The Phase-1 slice uses a single autosave slot. Manual save slots are a Phase-6
feature (`src/game/save/slots.ts` is the canonical place to add them).

## Autosave behaviour

`App.tsx` watches the Redux phase. When the phase transitions to `'paused'`, it
calls `writeSave(AUTOSAVE_SLOT, ...)` with the current score and zone id, then
dispatches `setSaveExists(true)` so the Continue button appears.

On mount, `hasSave(AUTOSAVE_SLOT)` is checked once to hydrate `state.save.hasSave`.

## Continue flow

1. User clicks **Continue** in the main menu.
2. `readSave(AUTOSAVE_SLOT)` resolves with the saved payload.
3. `setSaveLoaded(payload)` is dispatched — the payload is available at
   `state.save.loadedSave` for the scene to restore player position and score.
4. `continueGame()` is dispatched → phase transitions to `'playing'`.

## Tests

- `src/game/save/saveStore.test.ts` — round-trip, overwrite, multi-slot isolation,
  delete, hasSave (uses `fake-indexeddb` shim; 8 tests).
- `src/store/saveSlice.test.ts` — slice initial state, setSaveExists, setSaveLoaded
  (4 tests).
