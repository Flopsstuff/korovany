import type { ZoneId } from './types'

/**
 * Per-zone content layer (FLO-411, ADR-0004). The three world specs in
 * `docs/guide/worlds/*.md` are prose content briefs; this table is the code-side
 * binding that scenes actually read. Landmark + encounter data lives here, keyed
 * by the canonical {@link ZoneId} union; the prose stays in the docs.
 *
 * The keys are `ZoneId`s, which are persisted in saves — they are forever; never
 * rename one (*schema is forever*). Scenes consume this table by id and trust its
 * shape; the table is validated once in `zoneContent.test.ts` (*trust the
 * boundary*) so each scene need not re-check it.
 */

/** RGB albedo for a greybox landmark, each channel in `0..1`. */
export interface LandmarkColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

/**
 * A named, orienting structure in a zone (toll gate, shrine, stump hall…). Seeded
 * from each spec's "Landmark briefs". Today landmarks render as greybox boxes;
 * `assetKey` lets a later asset ticket swap in a streamed GLB without touching the
 * scene code.
 */
export interface ZoneLandmark {
  /** Stable identifier within the zone (kebab-case). */
  readonly id: string
  /** Human-readable design role, mirrored from the spec. */
  readonly role: string
  /** Ground placement on the X/Z plane (scene units). */
  readonly position: { readonly x: number; readonly z: number }
  /** Vertical extent of the greybox in scene units (also drives its `y`). */
  readonly height: number
  /** Footprint edge length of the greybox in scene units. */
  readonly size: number
  /** Greybox albedo. Omit once `assetKey` points at a real model. */
  readonly color?: LandmarkColor
  /** Asset-registry key for a streamed GLB; takes over from `color` when present. */
  readonly assetKey?: string
}

/** What kind of encounter actor an anchor seeds. */
export type EncounterKind = 'soldier' | 'caravan' | 'archer'

/**
 * A named spawn point for an encounter actor, distilled from each spec's
 * "Encounter hooks". Carries a full `{x, y, z}` because actors spawn slightly
 * above ground (capsule radius), unlike flat landmark footprints.
 */
export interface EncounterAnchor {
  /** Stable identifier within the zone (kebab-case). */
  readonly id: string
  readonly kind: EncounterKind
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
}

/** All code-side content for one zone. */
export interface ZoneContent {
  readonly landmarks: readonly ZoneLandmark[]
  readonly encounterAnchors: readonly EncounterAnchor[]
}

/**
 * The per-zone content table. `human-lands` (Velya) and `forest` (Lysaen) are the
 * two `available` zones and carry real content; `empire`/`mountains` stay `locked`
 * and minimal until their scenes exist.
 *
 * Sources:
 * - `human-lands` ← `docs/guide/worlds/velya-salt-road.md`
 * - `forest` ← `docs/guide/worlds/lysaen-emerald-thicket.md`
 */
export const ZONE_CONTENT: Readonly<Record<ZoneId, ZoneContent>> = {
  'human-lands': {
    // Seeded verbatim from the previous inline `LANDMARKS` const in
    // humanLandsScene.ts so the greybox renders identically — pure extraction.
    landmarks: [
      {
        id: 'watchtower',
        role: 'Old watchtower — high silhouette / scout perch',
        position: { x: 10, z: 8 },
        height: 5,
        size: 2,
        color: { r: 0.55, g: 0.5, b: 0.45 },
      },
      {
        id: 'roadside-shrine',
        role: "Saint Miro's shrine — midpoint marker / save fiction",
        position: { x: -9, z: 6 },
        height: 2,
        size: 2,
        color: { r: 0.6, g: 0.55, b: 0.4 },
      },
      {
        id: 'toll-gate',
        role: 'Broken toll gate — Empire checkpoint / escalation point',
        position: { x: -12, z: -8 },
        height: 3,
        size: 2,
        color: { r: 0.45, g: 0.35, b: 0.3 },
      },
    ],
    // Seeded verbatim from HUMAN_LANDS_SOLDIER_SPAWNS / HUMAN_LANDS_CARAVAN_SPAWNS.
    encounterAnchors: [
      { id: 'soldier-1', kind: 'soldier', position: { x: 6, y: 0.9, z: 8 } },
      { id: 'soldier-2', kind: 'soldier', position: { x: -10, y: 0.9, z: 5 } },
      { id: 'soldier-3', kind: 'soldier', position: { x: 14, y: 0.9, z: -10 } },
      { id: 'caravan-1', kind: 'caravan', position: { x: -8, y: 1, z: -6 } },
      { id: 'caravan-2', kind: 'caravan', position: { x: 12, y: 1, z: -12 } },
    ],
  },
  forest: {
    // Lysaen landmarks (docs/guide/worlds/lysaen-emerald-thicket.md "Landmark
    // briefs"). The forest scene streams its environment via GLB assets rather
    // than greybox boxes, so these are data-only today (consumed by MPG.5); they
    // still satisfy the "every available zone has >=1 landmark" invariant and give
    // the populate pass one source of truth.
    landmarks: [
      {
        id: 'stump-hall',
        role: 'Giant stump hall — faction hub / orientation centre',
        position: { x: 0, z: 0 },
        height: 6,
        size: 4,
        color: { r: 0.35, g: 0.27, b: 0.18 },
      },
      {
        id: 'moonwell-shrine',
        role: 'Moonwell shrine — healing/prosthetics fiction, quiet space',
        position: { x: -14, z: 18 },
        height: 2,
        size: 2,
        color: { r: 0.3, g: 0.45, b: 0.5 },
      },
      {
        id: 'axecut-clearing',
        role: 'Axecut clearing — Empire logging intrusion / combat arena',
        position: { x: 20, z: 24 },
        height: 3,
        size: 3,
        color: { r: 0.5, g: 0.4, b: 0.28 },
      },
    ],
    // Soldier anchors are ramped by distance from the player spawn (0,0,0) for a
    // survivable first session (P7.1 / FLO-412): every patrol sits ≥ 18 m out
    // (clear of the soldier aggro radius), with ONE lone first encounter just past
    // the buffer and the other four clustered in pairs guarding the two far
    // caravans — so the player meets one soldier first, not a wall of five on
    // spawn. `caravan-1` stays inside the buffer (10 m) and soldier-free, giving a
    // free first raid. Distances: s1 19.0, s2 25.6, s3 26.1, s4 24.4, s5 25.6 m.
    encounterAnchors: [
      { id: 'soldier-1', kind: 'soldier', position: { x: 0, y: 0.9, z: 19 } },
      { id: 'soldier-2', kind: 'soldier', position: { x: 20, y: 0.9, z: -16 } },
      { id: 'soldier-3', kind: 'soldier', position: { x: 14, y: 0.9, z: -22 } },
      { id: 'soldier-4', kind: 'soldier', position: { x: -20, y: 0.9, z: 14 } },
      { id: 'soldier-5', kind: 'soldier', position: { x: -16, y: 0.9, z: 20 } },
      { id: 'caravan-1', kind: 'caravan', position: { x: -8, y: 1, z: -6 } },
      { id: 'caravan-2', kind: 'caravan', position: { x: 10, y: 1, z: -14 } },
      { id: 'caravan-3', kind: 'caravan', position: { x: -14, y: 1, z: 12 } },
      // Ranged archers (FLO-432) — seeded *behind* the melee soldier wave (each
      // ~34 m out, past every soldier cluster) so a player meets a melee front
      // before any arrows fly. Both sit well beyond SAFE_SPAWN_BUFFER and the
      // archer's 15 m detection radius, so neither engages from the spawn.
      { id: 'archer-1', kind: 'archer', position: { x: 24, y: 0.9, z: -26 } },
      { id: 'archer-2', kind: 'archer', position: { x: -22, y: 0.9, z: 26 } },
    ],
  },
  // Locked zones: declared so the table is total over ZoneId, but empty until
  // their scenes (and specs' content) are built. Black Crown Pass spec exists as
  // prose; its content binding lands with the mountains scene.
  empire: { landmarks: [], encounterAnchors: [] },
  mountains: { landmarks: [], encounterAnchors: [] },
}

/**
 * Resolve a zone's content table. Sits next to `getZone()` (re-exported from
 * `./index`). Total over the `ZoneId` union — every zone has an entry (locked
 * zones return an empty table), so callers holding a `ZoneId` never branch on
 * `undefined`.
 */
export function getZoneContent(zoneId: ZoneId): ZoneContent {
  return ZONE_CONTENT[zoneId]
}
