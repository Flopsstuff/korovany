import { describe, expect, it } from 'vitest'
import { FACTION_IDS } from '../faction'
import { issueSquadOrder, type CommandEntity } from './orders'

const commander: CommandEntity = {
  id: 'captain',
  factionId: FACTION_IDS.Empire,
}

const subordinate: CommandEntity = {
  id: 'guard-1',
  factionId: FACTION_IDS.Empire,
  commanderId: commander.id,
}

describe('issueSquadOrder', () => {
  it('issues follow orders to same-faction subordinates', () => {
    const result = issueSquadOrder({
      commander,
      recipients: [subordinate],
      order: { type: 'follow' },
    })

    expect(result.rejected).toEqual([])
    expect(result.accepted).toEqual([
      { type: 'follow', commanderId: 'captain', recipientId: 'guard-1' },
    ])
  })

  it('rejects recipients outside the commander faction', () => {
    const result = issueSquadOrder({
      commander,
      recipients: [{ ...subordinate, id: 'elf', factionId: FACTION_IDS.ForestElves }],
      order: { type: 'hold' },
    })

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ recipientId: 'elf', reason: 'different-faction' }])
  })

  it('rejects non-subordinates even when they share faction', () => {
    const result = issueSquadOrder({
      commander,
      recipients: [{ ...subordinate, commanderId: 'other-captain' }],
      order: { type: 'hold' },
    })

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ recipientId: 'guard-1', reason: 'not-subordinate' }])
  })

  it('allows attack-target only against hostile factions', () => {
    const hostile: CommandEntity = {
      id: 'raider',
      factionId: FACTION_IDS.Villain,
    }

    const result = issueSquadOrder({
      commander,
      recipients: [subordinate],
      order: { type: 'attack-target', targetId: hostile.id },
      potentialTargets: [hostile],
    })

    expect(result.accepted).toEqual([
      {
        type: 'attack-target',
        commanderId: 'captain',
        recipientId: 'guard-1',
        targetId: 'raider',
      },
    ])
    expect(result.rejected).toEqual([])
  })

  it('rejects attack-target against non-hostile factions', () => {
    const ally: CommandEntity = {
      id: 'guard-2',
      factionId: FACTION_IDS.Empire,
    }

    const result = issueSquadOrder({
      commander,
      recipients: [subordinate],
      order: { type: 'attack-target', targetId: ally.id },
      potentialTargets: [ally],
    })

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ recipientId: 'guard-1', reason: 'non-hostile-target' }])
  })

  it('rejects move-to orders with non-finite destinations', () => {
    const result = issueSquadOrder({
      commander,
      recipients: [subordinate],
      order: { type: 'move-to', destination: { x: Number.NaN, y: 0, z: 0 } },
    })

    expect(result.accepted).toEqual([])
    expect(result.rejected).toEqual([{ recipientId: 'guard-1', reason: 'invalid-destination' }])
  })
})
