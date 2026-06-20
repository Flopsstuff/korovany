/**
 * Character progression model.
 *
 * Pure, serialisable, and additive: combat / economy systems can award
 * progression events, while health and combat damage keep their existing rules
 * until a later ticket consumes the derived bonuses.
 */

export type StatId = 'strength' | 'agility' | 'endurance'
export type SkillId = 'melee' | 'trade' | 'survival'
export type CombatKillTarget = 'soldier' | 'caravan'

export interface ProgressTrack {
  /** Current stat/skill rank. Stats start at 10; skills start at 1. */
  readonly level: number
  /** Lifetime XP in this track. The rank is derived from this value. */
  readonly xp: number
}

export type StatTracks = Readonly<Record<StatId, ProgressTrack>>
export type SkillTracks = Readonly<Record<SkillId, ProgressTrack>>

export interface ProgressionState {
  /** Current character level, derived from lifetime character XP. */
  readonly level: number
  /** Lifetime character XP. */
  readonly xp: number
  /** XP required to reach the next character level. */
  readonly nextLevelXp: number
  readonly stats: StatTracks
  readonly skills: SkillTracks
}

export interface ProgressionEvent {
  /** Human/debug label for the event source. */
  readonly source: string
  readonly xp: number
  readonly statXp?: Partial<Record<StatId, number>>
  readonly skillXp?: Partial<Record<SkillId, number>>
}

export interface PurchaseProgressionInput {
  /** Total purchase value in the current economy units. */
  readonly value: number
}

const BASE_STAT = 10
const BASE_SKILL = 1
const LEVEL_XP = 100
const STAT_XP = 60
const SKILL_XP = 50

function cleanXp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function characterLevelForXp(xp: number): number {
  return 1 + Math.floor(cleanXp(xp) / LEVEL_XP)
}

function nextCharacterLevelXp(level: number): number {
  return Math.max(1, level) * LEVEL_XP
}

function track(baseLevel: number, xp: number, xpPerLevel: number): ProgressTrack {
  const clean = cleanXp(xp)
  return { level: baseLevel + Math.floor(clean / xpPerLevel), xp: clean }
}

function createStats(): StatTracks {
  return {
    strength: track(BASE_STAT, 0, STAT_XP),
    agility: track(BASE_STAT, 0, STAT_XP),
    endurance: track(BASE_STAT, 0, STAT_XP),
  }
}

function createSkills(): SkillTracks {
  return {
    melee: track(BASE_SKILL, 0, SKILL_XP),
    trade: track(BASE_SKILL, 0, SKILL_XP),
    survival: track(BASE_SKILL, 0, SKILL_XP),
  }
}

export function createProgression(): ProgressionState {
  const xp = 0
  const level = characterLevelForXp(xp)
  return {
    level,
    xp,
    nextLevelXp: nextCharacterLevelXp(level),
    stats: createStats(),
    skills: createSkills(),
  }
}

function addTrackXp(
  tracks: Readonly<Record<string, ProgressTrack>>,
  delta: Partial<Record<string, number>> | undefined,
  baseLevel: number,
  xpPerLevel: number,
): Readonly<Record<string, ProgressTrack>> {
  if (!delta) return tracks
  const next: Record<string, ProgressTrack> = { ...tracks }
  for (const [id, amount] of Object.entries(delta)) {
    const current = tracks[id]
    if (!current) continue
    const xp = current.xp + cleanXp(amount ?? 0)
    next[id] = track(baseLevel, xp, xpPerLevel)
  }
  return next
}

function addStatXp(
  tracks: StatTracks,
  delta: Partial<Record<StatId, number>> | undefined,
): StatTracks {
  return addTrackXp(tracks, delta, BASE_STAT, STAT_XP) as StatTracks
}

function addSkillXp(
  tracks: SkillTracks,
  delta: Partial<Record<SkillId, number>> | undefined,
): SkillTracks {
  return addTrackXp(tracks, delta, BASE_SKILL, SKILL_XP) as SkillTracks
}

export function applyProgressionEvent(
  state: ProgressionState,
  event: ProgressionEvent,
): ProgressionState {
  const xp = state.xp + cleanXp(event.xp)
  const level = characterLevelForXp(xp)
  return {
    level,
    xp,
    nextLevelXp: nextCharacterLevelXp(level),
    stats: addStatXp(state.stats, event.statXp),
    skills: addSkillXp(state.skills, event.skillXp),
  }
}

export function combatKillProgressionEvent(target: CombatKillTarget): ProgressionEvent {
  if (target === 'soldier') {
    return {
      source: 'combat.kill.soldier',
      xp: 35,
      statXp: { strength: 12, endurance: 8 },
      skillXp: { melee: 20 },
    }
  }
  return {
    source: 'combat.kill.caravan',
    xp: 25,
    statXp: { agility: 4, endurance: 5 },
    skillXp: { survival: 10 },
  }
}

export function purchaseProgressionEvent(input: PurchaseProgressionInput): ProgressionEvent {
  const valueXp = Math.max(1, Math.floor(cleanXp(input.value) / 5))
  return {
    source: 'economy.purchase',
    xp: valueXp,
    statXp: { agility: Math.ceil(valueXp / 2) },
    skillXp: { trade: valueXp },
  }
}

export function damageMultiplier(state: ProgressionState): number {
  const strengthBonus = (state.stats.strength.level - BASE_STAT) * 0.03
  const meleeBonus = (state.skills.melee.level - BASE_SKILL) * 0.02
  return 1 + strengthBonus + meleeBonus
}

export function maxHealthBonus(state: ProgressionState): number {
  return (state.stats.endurance.level - BASE_STAT) * 5
}

export function movementSpeedMultiplier(state: ProgressionState): number {
  return 1 + (state.stats.agility.level - BASE_STAT) * 0.015
}

export function isProgressionState(value: unknown): value is ProgressionState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.level === 'number' &&
    typeof v.xp === 'number' &&
    typeof v.nextLevelXp === 'number' &&
    isTrackMap(v.stats, ['strength', 'agility', 'endurance']) &&
    isTrackMap(v.skills, ['melee', 'trade', 'survival'])
  )
}

function isTrackMap(value: unknown, keys: readonly string[]): boolean {
  if (typeof value !== 'object' || value === null) return false
  const map = value as Record<string, unknown>
  return keys.every((key) => {
    const t = map[key]
    if (typeof t !== 'object' || t === null) return false
    const trackValue = t as Record<string, unknown>
    return (
      typeof trackValue.level === 'number' &&
      Number.isFinite(trackValue.level) &&
      typeof trackValue.xp === 'number' &&
      Number.isFinite(trackValue.xp)
    )
  })
}
