import { FACTION_IDS, resolveStance, type FactionId } from '../faction/factions'
import { ZONES } from './zones'
import type { Faction, ZoneDefinition } from './types'

/** Local zone lookup (kept off `./index` to avoid an import cycle). */
function lookupZone(id: string): ZoneDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(ZONES, id) ? ZONES[id as keyof typeof ZONES] : undefined
}

/**
 * Per-zone, per-faction directive — the lightweight "objective hook" a zone scene
 * surfaces so the world never feels directionless (E8.1 acceptance / FLO-427).
 *
 * This is intentionally *not* the win condition (that stays the caravan-raid count
 * in `gameSlice` / `objectiveMachine`). It is a one-line standing order derived
 * from the player's faction stance toward the zone's owner, so the same palace
 * reads as **defend** to a Palace Guard and **attack/raid** to an Elf or Villain:
 *
 * - allied with the owner → `defend` the zone (Palace Guard holding the palace —
 *   the seat of the E4.3 commander orders).
 * - hostile to the owner  → `raid` the zone (Elf/Villain striking the crown).
 * - neutral               → `patrol` / hold the line.
 *
 * It reuses {@link resolveStance} so the relationship matrix stays the single
 * source of truth; widening to a new zone needs no change here.
 */
export type DirectiveKind = 'defend' | 'raid' | 'patrol'

export interface ZoneDirective {
  /** Stance-derived drive (defend / raid / patrol). */
  readonly kind: DirectiveKind
  /** One-line, player-facing standing order shown in the HUD. */
  readonly summary: string
}

/**
 * Bridge the zone-owner {@link Faction} (kebab-case, e.g. `forest-elves`) to the
 * canonical {@link FactionId} (camelCase, e.g. `forestElves`). The two id schemes
 * are deliberately separate (world registry vs faction model); this is the only
 * place they meet.
 */
const OWNER_TO_FACTION_ID: Readonly<Record<Faction, FactionId>> = {
  neutral: FACTION_IDS.Neutral,
  empire: FACTION_IDS.Empire,
  'forest-elves': FACTION_IDS.ForestElves,
  villain: FACTION_IDS.Villain,
}

/** The faction id of a zone's owner, for stance resolution. */
export function ownerFactionId(owner: Faction): FactionId {
  return OWNER_TO_FACTION_ID[owner]
}

/**
 * Resolve the standing order for `playerFactionId` in zone `zoneId`. Unknown zones
 * (defensive — the registry is total over `ZoneId`) fall back to a neutral patrol.
 */
export function getZoneDirective(zoneId: string, playerFactionId: FactionId): ZoneDirective {
  const zone = lookupZone(zoneId)
  if (!zone) {
    return { kind: 'patrol', summary: 'Hold the line.' }
  }
  const stance = resolveStance(playerFactionId, ownerFactionId(zone.ownerFaction))
  switch (stance) {
    case 'allied':
      return {
        kind: 'defend',
        summary: `Defend ${zone.loreName} — hold the line for ${zone.ownerLabel}.`,
      }
    case 'hostile':
      return {
        kind: 'raid',
        summary: `Raid ${zone.ownerLabel} across ${zone.loreName}.`,
      }
    case 'neutral':
    default:
      return {
        kind: 'patrol',
        summary: `Patrol ${zone.loreName} and keep the peace.`,
      }
  }
}
