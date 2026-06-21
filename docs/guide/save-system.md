# Save system

Korovany persists player progress locally so a game survives a browser reload.
The system is small and deliberately scoped: a versioned snapshot of the player,
stored in **IndexedDB**, restored on **Continue**.

Source lives in [`src/game/save/`](https://github.com/Flopsstuff/korovany/tree/main/src/game/save).

## What is saved

A save record is a single small JSON-shaped object:

| Field       | Meaning                                                        |
| ----------- | ------------------------------------------------------------- |
| `version`         | Schema version the record was written with (currently `5`).   |
| `transform`       | Player capsule pose: `position` (`x,y,z`) + `rotationY` (yaw). |
| `health`          | Player health as `{ current, max }` so max HP survives reload. |
| `zoneId`          | Identifier of the zone the player was in.                     |
| `inventory`       | Carried loot: `{ counts: {itemId: n}, equippedItemId }` (v2).  |
| `playerFactionId` | The chosen player faction (v3), sourced from `factionSlice`.   |
| `progression`     | Character XP, level, stats, and skills (v4), sourced from `progressionSlice`. |
| `injury`          | Per-limb injury state (v5), sourced from `injurySlice`. |
| `savedAt`         | Epoch milliseconds the snapshot was taken (picks the latest). |

Only this compact state is persisted. **Assets are never saved** — meshes,
textures and audio always stream from their own pipeline. This mirrors the
"one small volume" lens: the save store holds a tiny payload, never bulk data.
The inventory follows the same discipline: it stores only item **ids + counts**,
never display names or art — those resolve from the static catalog at render time.

The transform comes from the live Babylon capsule; `health` comes from the
canonical `healthSlice` (`{ current, max }`, the single health authority);
`zoneId` comes from the Redux `player` slice; `inventory` comes from the
`inventory` slice (E3.4); `playerFactionId` comes from the `faction` slice
(E4.2 — chosen at New Game); `progression` comes from the `progression` slice
(E4.5); and `injury` comes from the `injury` slice (E6.1.1). (Zones are a
placeholder today — E1.1 is movement + camera only — so the
`player` slice seeds a sensible default: `zoneId: "forest"`. Health is real as
of E2.1.)

## Where it is stored

In the browser's **IndexedDB**, database `korovany-save`, object store `slots`
keyed by a numeric slot id. There is currently **one slot** — slot `0`, the
autosave slot. The slot model is built to grow: `saveGame`/`loadLatest` already
take a `slot` option and `latest()` selects by `savedAt`, so additional slots are
a UI concern, not a format change.

The data lives only on the user's device. It is not uploaded anywhere and is not
shared between browsers or machines.

## The scene bridge (required wiring)

The UI layer decides _when_ to save, but only the live Babylon scene knows the
player's pose. They meet through
[`src/game/save/playerRuntime.ts`](https://github.com/Flopsstuff/korovany/blob/main/src/game/save/playerRuntime.ts):

- **Every scene mounted into the `playing` state must call `registerPlayer({ read, write })` on boot** and the returned unregister function on dispose.
  `read` returns `controller.snapshot()`; `write` calls `controller.teleport(t)`.
- Autosave-on-pause reads the pose via `readPlayerTransform()`. **If no scene
  registered a handle, this returns `null` and the autosave silently writes
  nothing** — so the wiring is not optional.
- Continue stages the loaded pose with `stageSpawn()` (consumed by the next
  scene's `takeSpawn()`) _and_ `applyPlayerTransform()` to teleport an
  already-running scene, covering both "scene boots after Continue" and "scene
  already running".

Both the live forest zone (`forestScene.ts`) and the `?dev=controller`
playground register this handle; `forestScene.test.ts` guards the registration
so the slice cannot regress to saving nothing.

## When it saves and loads

- **Autosave on pause.** Entering the paused state (Escape from play, the E1.0
  pause transition) writes the current player snapshot to the autosave slot.
- **Continue.** The main-menu **Continue** button loads the most recent slot,
  restores health + zone into the store, and teleports the player to the saved
  transform. It is **disabled with an empty-state hint when no save exists**.
- **New Game** resets the player to defaults; it does not erase the autosave, so
  a later Continue still resumes the last paused session until it is overwritten.

## Retention and clearing

Saves persist until overwritten by the next autosave or cleared. There is no
expiry. Programmatic clearing is available via `clearSave()`. Because the data
lives in IndexedDB, a user can also remove it by clearing site data for the app's
origin in their browser. Corrupt or unreadable records are ignored on load (the
game falls back to the empty-save state) rather than crashing.

## Schema is forever

Once a field ships it is **never renamed or silently repurposed**. Evolving the
format means bumping `SAVE_VERSION` in
[`src/game/save/types.ts`](https://github.com/Flopsstuff/korovany/blob/main/src/game/save/types.ts)
and adding a forward-migration step in `schema.ts` that maps the old shape onto
the new one. `parseSaveData()` validates and migrates every record on read, so a
save written by an old build still loads in a newer one.

Version history:

- **v1** — `transform`, `health`, `zoneId`, `savedAt`.
- **v2** — added `inventory` (E3.4). `migrate()` fills a fresh empty inventory for
  any pre-v2 save, so a v1 record loads cleanly as an empty-handed player. The
  guard (`isSaveData`) validates only the fields present since v1, leaving newer
  fields to `migrate()` — that is what keeps old saves loadable instead of
  rejected. See the v1 → v2 migration test in `src/game/save/schema.test.ts`.
- **v3** — added `playerFactionId` (E4.2, the New-Game faction choice).
  `migrate()` defaults any pre-v3 save to the `neutral` (unaffiliated) faction,
  and coerces an unrecognised persisted id to `neutral` rather than trusting it.
  See the v2 → v3 (and v1 → v3) migration tests in `schema.test.ts`.
- **v4** — added `progression` (E4.5). `migrate()` fills a fresh baseline
  progression state for pre-v4 saves, while current saves carry XP, level, stat
  tracks, and skill tracks forward.
- **v5** — added `injury` (E6.1.1). `migrate()` fills a fresh intact injury
  state for pre-v5 saves; malformed persisted injury blobs are coerced slot-by-slot.
  See the v4 → v5 migration test in `schema.test.ts`.

## Testing

The whole layer runs headless under jsdom by injecting an `IDBFactory`
(`fake-indexeddb`) into `openSaveStore(factory)` / the convenience helpers — no
globals required. See `src/game/save/save.test.ts` for the round-trip,
version-field, empty-store and corrupt-record cases.
