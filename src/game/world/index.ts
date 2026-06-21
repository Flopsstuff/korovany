import type { PlayerTransform } from '../save'
import { ZONE_ORDER, ZONES } from './zones'
import type { ZoneDefinition, ZoneId } from './types'

export type { Faction, ZoneDefinition, ZoneId, ZoneStatus, ZoneStreaming } from './types'
export { ZONES, ZONE_ORDER, ZONE_CARAVAN_QUOTAS, ZONE_CONQUEST_ORDER } from './zones'
export type {
  EncounterAnchor,
  EncounterKind,
  LandmarkColor,
  ZoneContent,
  ZoneLandmark,
} from './zoneContent'
export { ZONE_CONTENT, getZoneContent } from './zoneContent'
export type { DevUnlockEnv, ProdUnlockRuntime } from './devUnlock'
export {
  PROD_ZONE_UNLOCK_QUERY,
  PROD_ZONE_UNLOCK_STORAGE_KEY,
  allZoneIds,
  isAllZonesTravelUnlocked,
  isDevZoneUnlockEnabled,
  resolveProdZoneUnlockOptIn,
} from './devUnlock'
export type { DirectiveKind, ZoneDirective } from './zoneDirectives'
export { getZoneDirective, ownerFactionId } from './zoneDirectives'

/** All four zones in world-map display order. */
export function listZones(): ZoneDefinition[] {
  return ZONE_ORDER.map((id) => ZONES[id])
}

/** Type guard: is `id` one of the four canonical zone ids? */
export function isZoneId(id: string): id is ZoneId {
  return Object.prototype.hasOwnProperty.call(ZONES, id)
}

/** Resolve a zone definition, or `undefined` for an unknown id. */
export function getZone(id: string): ZoneDefinition | undefined {
  return isZoneId(id) ? ZONES[id] : undefined
}

/** Whether a zone exists and has a playable scene (so fast-travel may target it). */
export function isZoneAvailable(id: string): boolean {
  const zone = getZone(id)
  return zone?.status === 'available'
}

/** Why a fast-travel request was rejected. */
export type TravelError =
  | 'unknown-zone'
  | 'zone-locked'
  | 'already-here'
  | 'zone-not-yet-unlocked'

/** A validated fast-travel: the destination zone and the spawn to teleport to. */
export interface TravelPlan {
  readonly zone: ZoneDefinition
  readonly spawn: PlayerTransform
}

export type TravelResult =
  | { readonly ok: true; readonly plan: TravelPlan }
  | { readonly ok: false; readonly reason: TravelError }

/**
 * Pure fast-travel resolver — the testable core of the travel action. Validates
 * that the target exists, has a playable scene, is not the current zone, and —
 * when an `unlockedZoneIds` set is supplied — has been sequentially unlocked by
 * conquest progress (ADR 0005). Returns the destination + spawn. The caller (App)
 * performs the side effects: stage the spawn on the `playerRuntime` bridge and
 * dispatch `setZone`.
 *
 * Passing `unlockedZoneIds` is optional: omit it to skip the progression gate
 * (e.g. callers that have already validated unlock state).
 */
export function planTravel(
  currentZoneId: string,
  targetZoneId: string,
  unlockedZoneIds?: readonly string[],
): TravelResult {
  const zone = getZone(targetZoneId)
  if (!zone) return { ok: false, reason: 'unknown-zone' }
  if (zone.status !== 'available') return { ok: false, reason: 'zone-locked' }
  if (zone.id === currentZoneId) return { ok: false, reason: 'already-here' }
  if (unlockedZoneIds && !unlockedZoneIds.includes(zone.id)) {
    return { ok: false, reason: 'zone-not-yet-unlocked' }
  }
  return { ok: true, plan: { zone, spawn: zone.spawn } }
}
