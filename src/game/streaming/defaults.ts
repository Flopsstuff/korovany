import type { AssetRegistry } from './registry'

/** Canonical id for the Phase-1 player hero (FLO-270). */
export const HERO_PLAYER_ASSET_ID = 'hero.player-default'

/** Seed the registry with built-in assets shipped under `public/models/`. */
export function seedDefaultAssets(registry: AssetRegistry): void {
  registry.register(HERO_PLAYER_ASSET_ID, {
    url: '/models/korovany_hero_player-default.glb',
    metadata: { label: 'Player hero', targetSize: 2 },
  })
}
