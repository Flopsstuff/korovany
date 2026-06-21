import type { ZoneDefinition, ZoneId } from './types'

/**
 * The four world zones (game-plan §0). Forest and Human lands ship a playable
 * scene in E3.1; Empire (the palace) joins them in E8.1. Mountains stays `locked`
 * so the world map lists all four, but travel to it is disabled until its scene
 * exists.
 *
 * Lore names and faction colour come from `docs/guide/world-specs.md`. Spawns
 * are the capsule pose each zone's scene teleports the player to on arrival.
 */
export const ZONES: Readonly<Record<ZoneId, ZoneDefinition>> = {
  'human-lands': {
    id: 'human-lands',
    displayName: 'Human lands',
    loreName: 'The Salt Road of Velya',
    ownerFaction: 'neutral',
    ownerLabel: 'Neutral',
    spawn: { position: { x: 0, y: 2, z: 0 }, rotationY: 0 },
    status: 'available',
    streaming: { manifestId: 'zone.human-lands', sceneKey: 'human-lands' },
  },
  empire: {
    id: 'empire',
    displayName: 'Empire',
    loreName: 'The Imperial March',
    ownerFaction: 'empire',
    ownerLabel: 'The Emperor',
    spawn: { position: { x: 0, y: 2, z: 0 }, rotationY: 0 },
    status: 'available', // playable palace scene (E8.1 / FLO-427)
    streaming: { manifestId: 'zone.empire', sceneKey: 'empire' },
  },
  forest: {
    id: 'forest',
    displayName: 'Forest',
    loreName: 'The Emerald Thicket of Lysaen',
    ownerFaction: 'forest-elves',
    ownerLabel: 'Forest Elves',
    spawn: { position: { x: 0, y: 2, z: 0 }, rotationY: 0 },
    status: 'available',
    streaming: { manifestId: 'zone.forest', sceneKey: 'forest' },
  },
  mountains: {
    id: 'mountains',
    displayName: 'Mountains',
    loreName: 'Black Crown Pass',
    ownerFaction: 'villain',
    ownerLabel: 'The Villain',
    spawn: { position: { x: 0, y: 2, z: 0 }, rotationY: 0 },
    status: 'locked',
    streaming: { manifestId: 'zone.mountains', sceneKey: 'mountains' },
  },
}

/** Declaration order used by the world map (matches game-plan §0 table). */
export const ZONE_ORDER: readonly ZoneId[] = ['human-lands', 'empire', 'forest', 'mountains']
