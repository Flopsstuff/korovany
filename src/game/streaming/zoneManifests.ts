import type { Vec3 } from '../combat'
import type { ZoneAssetPlacement, ZoneManifest } from './zoneStreaming'

/**
 * Per-zone streaming content (E3.2 wiring, FLO-345).
 *
 * A {@link ZoneManifest} is the pure, engine-agnostic description of *what* a
 * zone streams and *where* — the data the {@link ZoneStreamingManager} loads on
 * entry and disposes on exit. Keeping it free of Babylon/React means it can be
 * unit-tested on its own and kept in lockstep with the E3.1 zone registry
 * (`src/game/world/zones.ts`) and the registry seeding in the scene factories.
 *
 * Asset ids here MUST be registered (url + metadata) by the owning scene before
 * a manager enters the zone — see `seedForestAssets` in `scenes/forestScene.ts`.
 * Zones whose environment is still procedural (human-lands landmarks) or that
 * have no scene yet (empire, mountains) declare an empty manifest until a later
 * asset ticket gives them streamed GLBs.
 */

/** Conifer tree scattered through the forest clearing (FLO-299). */
export const FOREST_TREE_ASSET_ID = 'env.forest-tree'
/** Wooden hut placed at the edge of the forest clearing (FLO-299). */
export const WOODEN_HUT_ASSET_ID = 'env.wooden-hut'
/** Static loot chest tucked into the forest as visible leftover decor (FLO-470). */
export const FOREST_CHEST_ASSET_ID = 'prop.forest-chest'
/** Static cargo crate used as forest caravan-camp decor (FLO-470). */
export const FOREST_CARGO_CRATE_ASSET_ID = 'prop.forest-cargo-crate'
/** Display wagon prop near the spawn-side raid route (FLO-470). */
export const FOREST_CARAVAN_WAGON_ASSET_ID = 'prop.forest-caravan-wagon'
/** Retired hero GLB reused as static forest elf NPC decor (FLO-470). */
export const FOREST_STATIC_ELF_ASSET_ID = 'npc.forest-static-elf'

/** Tree positions: (x, z) pairs in scene units. Keeps a 4-unit clearing. */
const FOREST_TREE_POSITIONS: readonly [number, number][] = [
  [8, 2],
  [-7, 3],
  [5, -9],
  [-9, -5],
  [12, -6],
  [-11, 7],
  [3, 11],
  [-4, -12],
  [9, 9],
  [-13, -2],
  [14, 3],
  [-6, 13],
]

/** Hut positions: a small settlement at one edge of the clearing. */
const FOREST_HUT_POSITIONS: readonly [number, number][] = [
  [-10, 10],
  [-14, 6],
  [-7, 15],
]

const FOREST_LEFTOVER_PLACEMENTS: readonly ZoneAssetPlacement[] = [
  {
    assetId: FOREST_CARAVAN_WAGON_ASSET_ID,
    position: { x: -5.5, y: 0, z: -9 },
    rotationY: Math.PI / 2,
  },
  {
    assetId: FOREST_CHEST_ASSET_ID,
    position: { x: -2.6, y: 0, z: -6.8 },
    rotationY: -0.35,
  },
  {
    assetId: FOREST_CARGO_CRATE_ASSET_ID,
    position: { x: -7.4, y: 0, z: -6.1 },
    rotationY: 0.45,
  },
  {
    assetId: FOREST_STATIC_ELF_ASSET_ID,
    position: { x: 5.5, y: 0, z: 7.5 },
    rotationY: -2.35,
  },
  {
    assetId: FOREST_STATIC_ELF_ASSET_ID,
    position: { x: -6.5, y: 0, z: 8.2 },
    rotationY: 2.25,
  },
]

/** Ground a scatter table at `y = 0`. */
function ground([x, z]: readonly [number, number]): Vec3 {
  return { x, y: 0, z }
}

const FOREST_MANIFEST: ZoneManifest = {
  id: 'forest',
  placements: [
    ...FOREST_TREE_POSITIONS.map((p) => ({ assetId: FOREST_TREE_ASSET_ID, position: ground(p) })),
    ...FOREST_HUT_POSITIONS.map((p) => ({ assetId: WOODEN_HUT_ASSET_ID, position: ground(p) })),
    ...FOREST_LEFTOVER_PLACEMENTS,
  ],
}

/**
 * Streamable content keyed by zone id (matches `playerSlice.zoneId` and the E3.1
 * registry). Empty manifests are intentional: the manager still "enters" the
 * zone (so the call site is uniform across travel) but loads nothing.
 */
export const ZONE_MANIFESTS: Readonly<Record<string, ZoneManifest>> = {
  forest: FOREST_MANIFEST,
  'human-lands': { id: 'human-lands', placements: [] },
  empire: { id: 'empire', placements: [] },
  mountains: { id: 'mountains', placements: [] },
}

/**
 * Resolve a zone's manifest. Unknown zones fall back to an empty manifest so a
 * scene can always enter *something* without a special-case — mirrors the
 * forest-fallback safety net in `createZoneScene`.
 */
export function getZoneManifest(zoneId: string): ZoneManifest {
  return ZONE_MANIFESTS[zoneId] ?? { id: zoneId, placements: [] }
}
