import { WORLD_SIZE } from './gridSize'

/**
 * Map-prop population layer (FLO-445). The two playable zones shipped with only a
 * handful of hand-placed landmarks clustered near the origin; after the world was
 * scaled 10× to {@link WORLD_SIZE} (FLO-368) that left the maps reading as empty
 * boxes. This module turns each spec's **20-by-20 text map** (the canonical legend
 * in `docs/guide/worlds/*.md`) into greybox primitive props spread across the full
 * world, so the zones read as inhabited before real GLB models exist.
 *
 * Sources (the grids below mirror the docs verbatim — same pattern as
 * `zoneContent.ts`: prose/spec in the docs, code-side binding here):
 * - `human-lands` ← `docs/guide/worlds/velya-salt-road.md` §"20-by-20 text map"
 * - `forest`      ← `docs/guide/worlds/lysaen-emerald-thicket.md` §"20-by-20 text map"
 *
 * The builder ({@link buildMapProps}) is pure and Babylon-free so the cell→world
 * mapping, counts, and spawn-clear exclusion are unit-testable without a renderer
 * (*trust the boundary*). `mapPropsRenderer.ts` (scenes) turns the specs into
 * thin-instanced meshes — one draw call per legend symbol, so a full map costs a
 * dozen draw calls, not hundreds (*budgets are real*). When real models land, the
 * renderer swaps a kind's primitive for a streamed GLB without touching this data.
 */

/** Greybox primitive used to stand in for a legend symbol until a model exists. */
export type PropShape = 'box' | 'slab' | 'cylinder' | 'cone' | 'sphere'

/** RGB albedo, each channel in `0..1`. */
export interface PropColor {
  readonly r: number
  readonly g: number
  readonly b: number
}

/** How one legend symbol renders: a primitive of a given footprint/height/colour. */
export interface MapPropStyle {
  readonly shape: PropShape
  readonly color: PropColor
  /** Base footprint edge / diameter in world units (before per-cell jitter). */
  readonly size: number
  /** Base vertical extent in world units (before per-cell jitter). */
  readonly height: number
  /**
   * Per-cell randomisation, `0..1` as a fraction of cell size. `0` keeps a rigid
   * grid (roads, water, walls); higher values scatter natural clutter (trees,
   * rocks) so repeated symbols don't read as a checkerboard.
   */
  readonly jitter: number
}

/** A 20×20 grid plus its legend → style table. `null` = open ground (no prop). */
export interface ZoneMapGrid {
  /** 20 rows of 20 chars each; row 01 is north, column 01 is west (per the docs). */
  readonly rows: readonly string[]
  /** Maps each legend symbol to its prop style; `null` symbols are skipped. */
  readonly legend: Readonly<Record<string, MapPropStyle | null>>
}

/** A single resolved prop instance, ready for the renderer to place. */
export interface MapPropSpec {
  /** The legend symbol this prop came from (renderer groups by it). */
  readonly kind: string
  readonly shape: PropShape
  /** World-space ground placement (already jittered within the cell). */
  readonly x: number
  readonly z: number
  /** Heading in radians (already jittered). */
  readonly yaw: number
  /** Footprint edge / diameter in world units (already jittered). */
  readonly size: number
  /** Vertical extent in world units (already jittered). */
  readonly height: number
  readonly color: PropColor
}

/** Grid dimension — every map is 20×20 cells. */
export const MAP_GRID_CELLS = 20

/**
 * Cells whose centre falls within this radius (world units) of the origin are
 * skipped, keeping the player's spawn point and immediate combat space open so a
 * giant stump or wall doesn't materialise on top of the capsule.
 */
export const SPAWN_CLEAR_RADIUS = 14

// ---------------------------------------------------------------------------
// Deterministic per-cell hash — integer bit-mixing (not sin-based, which aliases
// into visible bands for sequential indices), so jitter is stable across reloads
// and reproducible in tests. `salt` decorrelates the position/yaw/scale draws.
// ---------------------------------------------------------------------------
function cellHash(row: number, col: number, salt: number): number {
  let h = (Math.imul(row + 1, 374761393) + Math.imul(col + 1, 668265263) + Math.imul(salt + 1, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

/** Options for {@link buildMapProps}; defaults match the live zone world size. */
export interface BuildMapPropsOptions {
  /** Playable square side length the grid is mapped onto. Defaults to {@link WORLD_SIZE}. */
  readonly worldSize?: number
  /** Spawn-clear radius override (mostly for tests). */
  readonly spawnClearRadius?: number
}

/**
 * Resolve a {@link ZoneMapGrid} into placed {@link MapPropSpec}s. One prop per
 * filled, non-excluded cell. Pure and deterministic: same grid + options always
 * yields the same props, in row-major order. Throws if the grid is not 20×20 so a
 * doc-copy typo fails loudly at the boundary rather than silently shifting the map.
 */
export function buildMapProps(grid: ZoneMapGrid, options: BuildMapPropsOptions = {}): MapPropSpec[] {
  const worldSize = options.worldSize ?? WORLD_SIZE
  const spawnClear = options.spawnClearRadius ?? SPAWN_CLEAR_RADIUS
  const cell = worldSize / MAP_GRID_CELLS
  const half = worldSize / 2

  if (grid.rows.length !== MAP_GRID_CELLS) {
    throw new Error(`map grid must have ${MAP_GRID_CELLS} rows, got ${grid.rows.length}`)
  }

  const props: MapPropSpec[] = []
  grid.rows.forEach((row, r) => {
    if (row.length !== MAP_GRID_CELLS) {
      throw new Error(`map grid row ${r + 1} must have ${MAP_GRID_CELLS} cells, got ${row.length}`)
    }
    for (let c = 0; c < MAP_GRID_CELLS; c++) {
      const symbol = row[c]
      const style = grid.legend[symbol]
      if (!style) continue // open ground or unknown symbol → no prop

      // Cell centre in world space: row 01 (north) → +Z, column 01 (west) → −X.
      const cx = -half + (c + 0.5) * cell
      const cz = half - (r + 0.5) * cell

      // Per-cell jitter (decorrelated draws): position within the cell, heading,
      // and a uniform scale wobble so repeated props don't look stamped.
      const jx = (cellHash(r, c, 0) - 0.5) * style.jitter * cell
      const jz = (cellHash(r, c, 1) - 0.5) * style.jitter * cell
      const yaw = cellHash(r, c, 2) * Math.PI * 2
      const scale = 1 + (cellHash(r, c, 3) - 0.5) * 0.3 * (style.jitter > 0 ? 1 : 0)

      const x = cx + jx
      const z = cz + jz
      if (Math.hypot(x, z) < spawnClear) continue // keep the spawn/combat space open

      props.push({
        kind: symbol,
        shape: style.shape,
        x,
        z,
        yaw,
        size: style.size * scale,
        height: style.height * scale,
        color: style.color,
      })
    }
  })
  return props
}

// ---------------------------------------------------------------------------
// Zone grids — mirrored verbatim from the docs' "20-by-20 text map" tables. Keep
// these in sync with the docs; the 20×20 invariant is enforced by buildMapProps
// and asserted in mapProps.test.ts.
// ---------------------------------------------------------------------------

/**
 * Velya Salt Road (`human-lands`). Legend (velya-salt-road.md): `R` road,
 * `F` farm props, `H` hedge/fence, `P` black pine, `D` dry riverbed, `I` burned
 * inn, `S` shrine, `T` toll gate, `W` watchtower, `O` rocky overlook,
 * `C` caravan staging, `X` road barrier. `.` = open grass.
 */
export const HUMAN_LANDS_MAP: ZoneMapGrid = {
  rows: [
    '..............TTTT..',
    '............RRRTTTX.',
    '..........RRR...HHH.',
    '........RRR.....HFF.',
    '......RRR.....SS.FF.',
    'PP..RRR......SS..FF.',
    'PP.RR......HHH......',
    'PPRR....DDDDHH......',
    '.RR...DDDDDD....OO..',
    '.R...DD..C.DD...OO..',
    'RR.....CCCCDD.......',
    'R....HHH..DD....WWW.',
    'R...HH....D.....WWW.',
    'RR..............W...',
    '.RR....I...........P',
    '..RR...I...HH.....PP',
    '...RR..I..HHH....PPP',
    'FF..RR....HH.....PPP',
    'FFF..RR...........PP',
    'FFFF..RR............',
  ],
  legend: {
    '.': null, // open grass / scrub
    R: { shape: 'slab', color: { r: 0.55, g: 0.48, b: 0.36 }, size: 26, height: 0.3, jitter: 0 },
    F: { shape: 'box', color: { r: 0.72, g: 0.6, b: 0.3 }, size: 4.5, height: 3, jitter: 0.55 },
    H: { shape: 'box', color: { r: 0.22, g: 0.34, b: 0.18 }, size: 20, height: 2.6, jitter: 0.15 },
    P: { shape: 'cone', color: { r: 0.12, g: 0.26, b: 0.16 }, size: 10, height: 17, jitter: 0.45 },
    D: { shape: 'slab', color: { r: 0.56, g: 0.5, b: 0.4 }, size: 28, height: 0.15, jitter: 0 },
    I: { shape: 'box', color: { r: 0.28, g: 0.24, b: 0.22 }, size: 12, height: 6, jitter: 0.1 },
    S: { shape: 'cylinder', color: { r: 0.7, g: 0.68, b: 0.62 }, size: 7, height: 5, jitter: 0.1 },
    T: { shape: 'box', color: { r: 0.4, g: 0.3, b: 0.25 }, size: 9, height: 6, jitter: 0.2 },
    W: { shape: 'box', color: { r: 0.5, g: 0.47, b: 0.42 }, size: 9, height: 18, jitter: 0.05 },
    O: { shape: 'sphere', color: { r: 0.42, g: 0.42, b: 0.4 }, size: 11, height: 7, jitter: 0.4 },
    C: { shape: 'box', color: { r: 0.45, g: 0.3, b: 0.18 }, size: 7, height: 4, jitter: 0.3 },
    X: { shape: 'box', color: { r: 0.4, g: 0.16, b: 0.12 }, size: 11, height: 3, jitter: 0.1 },
  },
}

/**
 * Lysaen Emerald Thicket (`forest`). Legend (lysaen-emerald-thicket.md):
 * `T` dense tree, `t` sparse tree, `p` trail, `V` village ring, `G` giant stump
 * hall, `H` elevated hut, `B` rope bridge, `M` marsh pool, `S` moonwell shrine,
 * `A` axecut/logging, `E` empire camp, `C` courier marker. `.` = clearing/grass.
 */
export const FOREST_MAP: ZoneMapGrid = {
  rows: [
    'TTTTTTTTTTTAAAAAEEEE',
    'TTTTTTTttpAAAAAAEEE.',
    'TTTTTtttpppAAA..EE..',
    'TTTTttp...ppA.......',
    'TTTttp..SS.pp..TTTTT',
    'TTTtp..SS...p..TTTTT',
    'TTtp....MMM.p..TTTTT',
    'Tttp..MMMMM.pp..TTTT',
    'Ttp..MM..CMM.p...TTT',
    'ttp..M..VVVMMpp..TTT',
    'tp.....VHG.V..p..TTT',
    'tp..BB.VGGGV..p..TTT',
    'tpp.BB.VHVV...p..TTT',
    'T.p.....ppppppp..TTT',
    'T.ppp......C.....TTT',
    'TT..ppp..MMMM....TTT',
    'TTT...ppMMMMMM..TTTT',
    'TTTT...pppMMM..TTTTT',
    'TTTTT....ppp..TTTTTT',
    'TTTTTTTT..ppTTTTTTTT',
  ],
  legend: {
    '.': null, // clearing / grass
    T: { shape: 'cone', color: { r: 0.1, g: 0.3, b: 0.16 }, size: 11, height: 18, jitter: 0.45 },
    t: { shape: 'cone', color: { r: 0.16, g: 0.38, b: 0.2 }, size: 8, height: 13, jitter: 0.5 },
    p: { shape: 'slab', color: { r: 0.45, g: 0.36, b: 0.24 }, size: 26, height: 0.2, jitter: 0.1 },
    V: { shape: 'box', color: { r: 0.5, g: 0.38, b: 0.24 }, size: 5, height: 6, jitter: 0.4 },
    G: { shape: 'cylinder', color: { r: 0.32, g: 0.24, b: 0.16 }, size: 16, height: 9, jitter: 0.1 },
    H: { shape: 'box', color: { r: 0.46, g: 0.34, b: 0.22 }, size: 8, height: 7, jitter: 0.2 },
    B: { shape: 'slab', color: { r: 0.5, g: 0.4, b: 0.26 }, size: 12, height: 0.4, jitter: 0 },
    M: { shape: 'slab', color: { r: 0.2, g: 0.36, b: 0.34 }, size: 26, height: 0.12, jitter: 0 },
    S: { shape: 'cylinder', color: { r: 0.6, g: 0.66, b: 0.7 }, size: 7, height: 5, jitter: 0.1 },
    A: { shape: 'box', color: { r: 0.55, g: 0.42, b: 0.28 }, size: 6, height: 4, jitter: 0.4 },
    E: { shape: 'box', color: { r: 0.34, g: 0.32, b: 0.3 }, size: 7, height: 5, jitter: 0.3 },
    C: { shape: 'cylinder', color: { r: 0.72, g: 0.6, b: 0.2 }, size: 1.6, height: 6, jitter: 0 },
  },
}

/** Map grid for each populated zone, keyed by the scene's zone id. */
export const ZONE_MAPS: Readonly<Record<string, ZoneMapGrid>> = {
  'human-lands': HUMAN_LANDS_MAP,
  forest: FOREST_MAP,
}
