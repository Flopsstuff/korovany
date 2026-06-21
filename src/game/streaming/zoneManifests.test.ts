import { describe, expect, it } from 'vitest'
import { ZONE_ORDER } from '../world/zones'
import {
  FOREST_TREE_ASSET_ID,
  FOREST_CARGO_CRATE_ASSET_ID,
  FOREST_CARAVAN_WAGON_ASSET_ID,
  FOREST_CHEST_ASSET_ID,
  FOREST_STATIC_ELF_ASSET_ID,
  WOODEN_HUT_ASSET_ID,
  FOREST_WATCHTOWER_ASSET_ID,
  ZONE_MANIFESTS,
  getZoneManifest,
} from './zoneManifests'

describe('zone manifests', () => {
  it('declares a manifest for every registered zone', () => {
    for (const zoneId of ZONE_ORDER) {
      expect(ZONE_MANIFESTS[zoneId]).toBeDefined()
      expect(ZONE_MANIFESTS[zoneId].id).toBe(zoneId)
    }
  })

  it('streams the forest props plus leftover decor (12 trees, 3 huts, 6 leftovers)', () => {
    const forest = getZoneManifest('forest')
    const trees = forest.placements.filter((p) => p.assetId === FOREST_TREE_ASSET_ID)
    const huts = forest.placements.filter((p) => p.assetId === WOODEN_HUT_ASSET_ID)
    expect(trees).toHaveLength(12)
    expect(huts).toHaveLength(3)
    const watchtower = forest.placements.find((p) => p.assetId === FOREST_WATCHTOWER_ASSET_ID)
    expect(watchtower?.position).toEqual({ x: 12.5, y: 0, z: -13.5 })
    expect(watchtower?.rotationY).toBeCloseTo(-0.55)
    expect(forest.placements.filter((p) => p.assetId === FOREST_CHEST_ASSET_ID)).toHaveLength(1)
    expect(forest.placements.filter((p) => p.assetId === FOREST_CARGO_CRATE_ASSET_ID)).toHaveLength(1)
    expect(forest.placements.filter((p) => p.assetId === FOREST_CARAVAN_WAGON_ASSET_ID)).toHaveLength(1)
    expect(forest.placements.filter((p) => p.assetId === FOREST_STATIC_ELF_ASSET_ID)).toHaveLength(2)
  })

  it('grounds every forest placement at y = 0', () => {
    for (const placement of getZoneManifest('forest').placements) {
      expect(placement.position?.y).toBe(0)
    }
  })

  it('gives the still-procedural / locked zones an empty manifest', () => {
    for (const zoneId of ['human-lands', 'empire', 'mountains']) {
      expect(getZoneManifest(zoneId).placements).toHaveLength(0)
    }
  })

  it('falls back to an empty manifest for an unknown zone', () => {
    const manifest = getZoneManifest('atlantis')
    expect(manifest.id).toBe('atlantis')
    expect(manifest.placements).toHaveLength(0)
  })
})
