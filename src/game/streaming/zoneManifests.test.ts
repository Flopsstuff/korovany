import { describe, expect, it } from 'vitest'
import { ZONE_ORDER } from '../world/zones'
import {
  FOREST_TREE_ASSET_ID,
  WOODEN_HUT_ASSET_ID,
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

  it('streams the forest props (12 trees + 3 huts)', () => {
    const forest = getZoneManifest('forest')
    const trees = forest.placements.filter((p) => p.assetId === FOREST_TREE_ASSET_ID)
    const huts = forest.placements.filter((p) => p.assetId === WOODEN_HUT_ASSET_ID)
    expect(trees).toHaveLength(12)
    expect(huts).toHaveLength(3)
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
