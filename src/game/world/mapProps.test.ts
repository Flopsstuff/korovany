import { describe, expect, it } from 'vitest'
import {
  buildMapProps,
  FOREST_MAP,
  HUMAN_LANDS_MAP,
  MAP_GRID_CELLS,
  SPAWN_CLEAR_RADIUS,
  ZONE_MAPS,
  type MapPropStyle,
  type ZoneMapGrid,
} from './mapProps'

const EMPTY_ROW = '.'.repeat(MAP_GRID_CELLS)

/** A 20×20 grid with a single non-empty cell at (row, col) carrying `style`. */
function gridWith(row: number, col: number, sym: string, style: MapPropStyle): ZoneMapGrid {
  const rows = Array.from({ length: MAP_GRID_CELLS }, (_unused, r) => {
    if (r !== row) return EMPTY_ROW
    const chars = EMPTY_ROW.split('')
    chars[col] = sym
    return chars.join('')
  })
  return { rows, legend: { '.': null, [sym]: style } }
}

const BOX: MapPropStyle = { shape: 'box', color: { r: 0.5, g: 0.5, b: 0.5 }, size: 10, height: 5, jitter: 0 }

describe('buildMapProps', () => {
  it('maps the north-west corner cell to the world corner (row 01/col 01 → −X,+Z)', () => {
    const props = buildMapProps(gridWith(0, 0, 'X', BOX), { worldSize: 600 })
    expect(props).toHaveLength(1)
    // cell size 30; centre of cell (0,0) = (−300 + 15, 300 − 15).
    expect(props[0].x).toBeCloseTo(-285, 6)
    expect(props[0].z).toBeCloseTo(285, 6)
    expect(props[0]).toMatchObject({ kind: 'X', shape: 'box', size: 10, height: 5 })
  })

  it('places south-east corner at +X,−Z', () => {
    const props = buildMapProps(gridWith(19, 19, 'X', BOX), { worldSize: 600 })
    expect(props[0].x).toBeCloseTo(285, 6)
    expect(props[0].z).toBeCloseTo(-285, 6)
  })

  it('skips cells whose centre falls inside the spawn-clear radius', () => {
    // Cell (10,10) centre is ~21 m from the origin; shrink the world so it lands
    // inside the clear radius and is dropped.
    const near = buildMapProps(gridWith(10, 10, 'X', BOX), { worldSize: 60 })
    expect(near).toHaveLength(0)
    const far = buildMapProps(gridWith(0, 0, 'X', BOX), { worldSize: 60 })
    expect(far).toHaveLength(1)
  })

  it('is deterministic for a given grid + options', () => {
    const a = JSON.stringify(buildMapProps(HUMAN_LANDS_MAP))
    const b = JSON.stringify(buildMapProps(HUMAN_LANDS_MAP))
    expect(a).toBe(b)
  })

  it('throws on a grid that is not 20 rows', () => {
    expect(() => buildMapProps({ rows: ['.'], legend: {} })).toThrow(/20 rows/)
  })

  it('throws on a row that is not 20 cells', () => {
    const rows = Array.from({ length: MAP_GRID_CELLS }, () => EMPTY_ROW)
    rows[3] = '.'.repeat(19)
    expect(() => buildMapProps({ rows, legend: { '.': null } })).toThrow(/20 cells/)
  })

  it('every emitted prop sits at or beyond the spawn-clear radius', () => {
    for (const grid of [HUMAN_LANDS_MAP, FOREST_MAP]) {
      for (const p of buildMapProps(grid)) {
        expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(SPAWN_CLEAR_RADIUS)
      }
    }
  })
})

describe('zone map grids', () => {
  it('exposes a grid for each populated zone', () => {
    expect(Object.keys(ZONE_MAPS).sort()).toEqual(['forest', 'human-lands'])
  })

  it.each([
    ['human-lands', HUMAN_LANDS_MAP],
    ['forest', FOREST_MAP],
  ])('%s grid is exactly 20×20 (mirrors the doc text map)', (_id, grid) => {
    expect(grid.rows).toHaveLength(MAP_GRID_CELLS)
    for (const row of grid.rows) expect(row).toHaveLength(MAP_GRID_CELLS)
  })

  it('both zones populate the world with a substantial prop count', () => {
    // Sanity that the maps actually fill the world rather than the old handful of
    // origin-clustered landmarks (FLO-445).
    expect(buildMapProps(HUMAN_LANDS_MAP).length).toBeGreaterThan(50)
    expect(buildMapProps(FOREST_MAP).length).toBeGreaterThan(120)
  })

  it('every legend symbol used in a grid has a style or is explicit ground', () => {
    for (const grid of [HUMAN_LANDS_MAP, FOREST_MAP]) {
      for (const row of grid.rows) {
        for (const ch of row) {
          expect(ch in grid.legend).toBe(true)
        }
      }
    }
  })
})
