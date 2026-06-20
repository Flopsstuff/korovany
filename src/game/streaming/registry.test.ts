import { describe, expect, it } from 'vitest'
import { AssetRegistry } from './registry'
import { HERO_PLAYER_ASSET_ID, seedDefaultAssets } from './defaults'

describe('AssetRegistry', () => {
  it('resolves a registered id to its url and metadata', () => {
    const registry = new AssetRegistry()
    registry.register('chest', { url: '/models/chest.glb', metadata: { label: 'Chest' } })

    expect(registry.resolve('chest')).toEqual({
      url: '/models/chest.glb',
      metadata: { label: 'Chest' },
    })
  })

  it('throws on unknown ids', () => {
    const registry = new AssetRegistry()
    expect(() => registry.resolve('missing')).toThrow('Unknown asset id: missing')
  })

  it('rejects duplicate registration', () => {
    const registry = new AssetRegistry()
    registry.register('a', { url: '/a.glb', metadata: {} })
    expect(() => registry.register('a', { url: '/b.glb', metadata: {} })).toThrow(
      'Asset id already registered: a',
    )
  })
})

describe('seedDefaultAssets', () => {
  it('registers the hero player GLB', () => {
    const registry = new AssetRegistry()
    seedDefaultAssets(registry)

    const record = registry.resolve(HERO_PLAYER_ASSET_ID)
    expect(record.url).toBe('/models/korovany_hero_player-default.glb')
    expect(record.metadata.label).toBe('Player hero')
  })
})
