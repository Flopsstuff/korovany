# World map & zones

The world is split into **four zones** (game-plan §0). The world-map overlay
lets the player **fast-travel** between the zones that have a playable scene.
This is the Phase-3 scaffolding (E3.1); zone-streaming on border crossing is
E3.2, and the caravan/loot loop is E3.3/E3.4.

For the level-design lore and layout targets behind each zone, see the
[World specs](./world-specs). For the overlay's interaction design, wireframes,
states, tokens, and accessibility, see the
[World-map overlay UX spec](./world-map-overlay-ux).

## The four zones

| Id | Display name | Lore name | Owner | Status |
| -- | ------------ | --------- | ----- | ------ |
| `human-lands` | Human lands | The Salt Road of Velya | Neutral | available |
| `empire` | Empire | The Imperial March | The Emperor | locked |
| `forest` | Forest | The Emerald Thicket of Lysaen | Forest Elves | available |
| `mountains` | Mountains | Black Crown Pass | The Villain | locked |

`available` zones have a scene and can be travelled to. `locked` zones are
declared in the registry so the world map can list all four, but travel to them
is disabled until their scene is built. The open zones are **Forest** and
**Human Lands**; MPG.5 populates both on entry with caravans and soldier patrols
so fast-travel never lands the player in an empty combat zone.

## Zone registry

The registry lives in `src/game/world/` (engine-agnostic — no Babylon or React):

- `zones.ts` — the four `ZoneDefinition`s (`id`, `displayName`, `loreName`,
  `ownerFaction`/`ownerLabel`, `spawn` transform, `status`, and a `streaming`
  entry point referencing the zone's asset manifest + scene key).
- `index.ts` — lookups (`listZones`, `getZone`, `isZoneAvailable`) and the pure
  fast-travel resolver `planTravel(currentZoneId, targetZoneId)`, which validates
  the target (must exist, be unlocked, and not be the current zone) and returns
  the destination zone plus the spawn to teleport to.

Zone ids are persisted in saves via `playerSlice.zoneId`, so they are **forever**
— never rename one without a save migration.

## Fast-travel flow

1. The player opens the world map from the HUD **Travel** button or by pressing
   **M** during live play.
2. Selecting an available zone shows a **Travel / Cancel** confirm (a two-step
   affordance so a stray click never teleports the player).
3. On confirm, `App` calls `planTravel`, stages the destination spawn on the
   `playerRuntime` bridge (`stageSpawn`), and dispatches `setZone(targetId)`.
4. Changing `zoneId` remounts `GameCanvas` with the destination scene
   (`createZoneScene` in `src/scenes/zoneScenes.ts`), which consumes the staged
   spawn on boot (`takeSpawn`) — landing the player at the zone's spawn point.

The overlay handles its **empty**, **loading** ("Travelling…"), and **error**
states. Its interaction design, wireframes, state matrix, tokens, and
accessibility are specified in the
[World-map overlay UX spec](./world-map-overlay-ux) (E3.1-UX).

## Streaming entry point (E3.2, wired in FLO-345)

`createZoneScene(zoneId, canvas, options)` is the single place a zone's scene is
booted. Each zone scene drives a `ZoneStreamingManager` and enters its
`ZoneManifest` (`getZoneManifest(zoneId)`) on boot, so the zone's content streams
in on arrival and disposes when the scene is torn down on the next border
crossing. See [Asset streaming → Wired into travel](./asset-streaming) for the
manager lifecycle and the per-zone manifests in
`src/game/streaming/zoneManifests.ts`.
