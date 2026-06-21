import type { LootDrop } from '../game/loot'
import type { CombatKillTarget } from '../game/progression'
import { getZone } from '../game/world'
import { createForestScene } from './forestScene'
import { createHumanLandsScene } from './humanLandsScene'
import { createMountainsScene } from './mountainsScene'

/**
 * Options common to every zone scene. The scenes layer hands these down from the
 * App; combat-only options are accepted (and ignored) by zones without combat so
 * a single call site can mount any zone.
 */
export interface ZoneSceneOptions {
  onPlayerDamaged?: (amount: number) => void
  /** Fired when the player defeats a caravan (E3.5); ignored by zones with no caravan. */
  onCaravanLooted?: (drop: LootDrop) => void
  /** Fired once per defeated combat target so progression can award XP. */
  onEnemyDefeated?: (target: CombatKillTarget) => void
  /** Fired when the player defeats an enemy soldier (MPG.1 score); ignored by zones with no combat. */
  onEnemyKilled?: () => void
  isPaused?: () => boolean
  /**
   * Per-step locomotion speed multiplier (1 = normal). Surfaces the leg-loss
   * crawl outcome to the capsule controller (MPG.6). Defaults to full speed.
   */
  getSpeedMultiplier?: () => number
}

/** The minimal handle the GameCanvas needs to tear a zone scene down. */
export interface ZoneSceneHandle {
  dispose(): void
}

/**
 * Resolve a zone id to its Babylon GameScene and boot it (E3.1 streaming entry
 * point). E3.1 loads eagerly; E3.2 grows this into streaming load/unload on
 * border crossing. Unknown or not-yet-built zones fall back to the forest so the
 * app never mounts a blank canvas — the world map already prevents travel to
 * locked zones, so this is just a safety net.
 */
export function createZoneScene(
  zoneId: string,
  canvas: HTMLCanvasElement,
  options: ZoneSceneOptions = {},
): ZoneSceneHandle {
  const zone = getZone(zoneId)
  switch (zone?.streaming.sceneKey) {
    case 'human-lands':
      return createHumanLandsScene(canvas, options)
    case 'mountains':
      return createMountainsScene(canvas, options)
    case 'forest':
    default:
      return createForestScene(canvas, options)
  }
}
