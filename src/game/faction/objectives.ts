/**
 * Asymmetric per-faction objective data (E4.2).
 *
 * Each playable faction plays toward a different goal set: the Forest Elves
 * raid the settled powers and hold the wood; the Palace Guard obey the commander
 * and hold the palace; the Villain commands the dark host and besieges the
 * Empire. The data here is **declarative** — it describes intent (raid whom,
 * defend where) without driving any behaviour. Later tickets (commander/order
 * system, AI targeting, quest tracking) consume it; this ticket only ships the
 * typed source of truth and the New-Game picker that records the choice.
 *
 * Objective `id`s are stable strings — quest/progress tracking will point at
 * them, so treat them like faction ids and do not rename after they ship.
 */

import {
  FACTION_IDS,
  FACTIONS,
  PLAYABLE_FACTION_IDS,
  type FactionId,
  type PlayableFactionId,
} from './factions'

/** The shape of a faction's drive, used by later AI / quest integrations. */
export type ObjectiveKind = 'raid' | 'defend' | 'obey' | 'command' | 'attack'

export interface FactionObjective {
  /** Stable id for quest/progress tracking. Do not rename after shipping. */
  readonly id: string
  /** What kind of drive this is (raid / defend / obey / command / attack). */
  readonly kind: ObjectiveKind
  /** One-line player-facing summary. */
  readonly summary: string
  /** Faction this objective is aimed at, for `raid` / `attack`. */
  readonly targetFactionId?: FactionId
  /** Region this objective protects, for `defend`. */
  readonly targetRegion?: string
}

export interface FactionPlaybook {
  readonly factionId: PlayableFactionId
  /** Short role label shown in the picker (e.g. "Palace Guard"). */
  readonly role: string
  /** One-line pitch shown under the role. */
  readonly tagline: string
  readonly objectives: readonly FactionObjective[]
}

export const FACTION_PLAYBOOKS: Readonly<Record<PlayableFactionId, FactionPlaybook>> = {
  forestElves: {
    factionId: FACTION_IDS.ForestElves,
    role: 'Forest Elf',
    tagline: 'Raid the settled powers and keep the old wood free.',
    objectives: [
      {
        id: 'elf-raid-empire',
        kind: 'raid',
        summary: 'Raid Imperial caravans and palace patrols.',
        targetFactionId: FACTION_IDS.Empire,
      },
      {
        id: 'elf-raid-villain',
        kind: 'raid',
        summary: 'Strike villain warbands that push into the wood.',
        targetFactionId: FACTION_IDS.Villain,
      },
      {
        id: 'elf-defend-forest',
        kind: 'defend',
        summary: 'Defend the forest groves and hidden routes.',
        targetRegion: 'Emerald Thicket',
      },
    ],
  },
  empire: {
    factionId: FACTION_IDS.Empire,
    role: 'Palace Guard',
    tagline: 'Serve the crown — follow orders, hold the palace.',
    objectives: [
      {
        id: 'empire-obey-commander',
        kind: 'obey',
        summary: 'Obey the palace commander’s orders.',
      },
      {
        id: 'empire-defend-palace',
        kind: 'defend',
        summary: 'Defend the palace and the crown roads.',
        targetRegion: 'Imperial palace',
      },
    ],
  },
  villain: {
    factionId: FACTION_IDS.Villain,
    role: 'Villain',
    tagline: 'Command the dark host and break the Empire.',
    objectives: [
      {
        id: 'villain-command-troops',
        kind: 'command',
        summary: 'Command your troops on the field.',
      },
      {
        id: 'villain-attack-palace',
        kind: 'attack',
        summary: 'Lay siege to the Imperial palace.',
        targetFactionId: FACTION_IDS.Empire,
      },
    ],
  },
}

/** Lookup the playbook for a selectable faction. */
export function getPlaybook(factionId: PlayableFactionId): FactionPlaybook {
  return FACTION_PLAYBOOKS[factionId]
}

/** A picker-ready view of a selectable faction: identity + asymmetric goals. */
export interface PlayableFactionOption {
  readonly id: PlayableFactionId
  readonly name: string
  readonly home: string
  readonly role: string
  readonly tagline: string
  readonly objectives: readonly FactionObjective[]
}

/**
 * The selectable factions in display order, each merged with its playbook. The
 * New-Game picker renders straight from this list, decoupled from raw data.
 */
export const PLAYABLE_FACTIONS: readonly PlayableFactionOption[] = PLAYABLE_FACTION_IDS.map((id) => {
  const def = FACTIONS[id]
  const playbook = FACTION_PLAYBOOKS[id]
  return {
    id,
    name: def.name,
    home: def.home,
    role: playbook.role,
    tagline: playbook.tagline,
    objectives: playbook.objectives,
  }
})
