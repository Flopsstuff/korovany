/**
 * Faction model — stable ids, reputation bounds, and pure stance resolution.
 *
 * Keep ids boring and durable: save data and future AI targeting will point at
 * these strings. Display names and lore labels can change without a schema bump.
 */

export const FACTION_IDS = {
  Neutral: 'neutral',
  Empire: 'empire',
  ForestElves: 'forestElves',
  Villain: 'villain',
} as const

export type FactionKey = keyof typeof FACTION_IDS
export type FactionId = (typeof FACTION_IDS)[FactionKey]
export type Stance = 'hostile' | 'neutral' | 'allied'

export interface FactionDefinition {
  readonly id: FactionId
  readonly key: FactionKey
  readonly name: string
  readonly home: string
  readonly description: string
}

export type Reputation = number
export type ReputationMap = Readonly<Record<FactionId, Reputation>>

export const MIN_REPUTATION = -100
export const MAX_REPUTATION = 100

export const FACTIONS: Readonly<Record<FactionId, FactionDefinition>> = {
  neutral: {
    id: FACTION_IDS.Neutral,
    key: 'Neutral',
    name: 'Neutral',
    home: 'Human lands',
    description: 'Independent human settlements, caravan masters, and unaffiliated locals.',
  },
  empire: {
    id: FACTION_IDS.Empire,
    key: 'Empire',
    name: 'Empire / Palace Guard',
    home: 'Imperial palace roads',
    description: 'Palace Guard patrols and imperial forces protecting crown interests.',
  },
  forestElves: {
    id: FACTION_IDS.ForestElves,
    key: 'ForestElves',
    name: 'Forest Elves',
    home: 'Emerald Thicket',
    description: 'Elven wardens defending the old forest routes and hidden groves.',
  },
  villain: {
    id: FACTION_IDS.Villain,
    key: 'Villain',
    name: 'Villain',
    home: 'Black Crown Pass',
    description: 'Hostile raiders and dark-aligned forces opposed by every settled faction.',
  },
}

export const FACTION_ID_LIST = [
  FACTION_IDS.Neutral,
  FACTION_IDS.Empire,
  FACTION_IDS.ForestElves,
  FACTION_IDS.Villain,
] as const satisfies readonly FactionId[]

export const DEFAULT_PLAYER_FACTION_ID = FACTION_IDS.Neutral

export const DEFAULT_REPUTATION: ReputationMap = {
  neutral: 0,
  empire: 0,
  forestElves: 0,
  villain: -75,
}

export const RELATIONSHIP_MATRIX: Readonly<Record<FactionId, Readonly<Record<FactionId, Stance>>>> = {
  neutral: {
    neutral: 'allied',
    empire: 'neutral',
    forestElves: 'neutral',
    villain: 'hostile',
  },
  empire: {
    neutral: 'neutral',
    empire: 'allied',
    forestElves: 'hostile',
    villain: 'hostile',
  },
  forestElves: {
    neutral: 'neutral',
    empire: 'hostile',
    forestElves: 'allied',
    villain: 'hostile',
  },
  villain: {
    neutral: 'hostile',
    empire: 'hostile',
    forestElves: 'hostile',
    villain: 'allied',
  },
}

export function clampReputation(value: number): Reputation {
  if (!Number.isFinite(value)) return 0
  return Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, Math.trunc(value)))
}

export function createDefaultReputation(): ReputationMap {
  return { ...DEFAULT_REPUTATION }
}

export function resolveStance(a: FactionId, b: FactionId): Stance {
  return RELATIONSHIP_MATRIX[a][b]
}

export function setReputation(
  reputation: ReputationMap,
  factionId: FactionId,
  value: number,
): ReputationMap {
  return { ...reputation, [factionId]: clampReputation(value) }
}

export function adjustReputation(
  reputation: ReputationMap,
  factionId: FactionId,
  delta: number,
): ReputationMap {
  return setReputation(reputation, factionId, reputation[factionId] + delta)
}
