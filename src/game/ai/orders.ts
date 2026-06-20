import { resolveStance, type FactionId } from '../faction'
import type { Vec3 } from '../combat'

export type OrderType = 'follow' | 'hold' | 'attack-target' | 'move-to'

export interface CommandEntity {
  readonly id: string
  readonly factionId: FactionId
  readonly commanderId?: string
  readonly alive?: boolean
}

export type OrderDraft =
  | { readonly type: 'follow' }
  | { readonly type: 'hold' }
  | { readonly type: 'attack-target'; readonly targetId: string }
  | { readonly type: 'move-to'; readonly destination: Vec3 }

export type SoldierOrder =
  | {
      readonly type: 'follow'
      readonly commanderId: string
      readonly recipientId: string
    }
  | {
      readonly type: 'hold'
      readonly commanderId: string
      readonly recipientId: string
    }
  | {
      readonly type: 'attack-target'
      readonly commanderId: string
      readonly recipientId: string
      readonly targetId: string
    }
  | {
      readonly type: 'move-to'
      readonly commanderId: string
      readonly recipientId: string
      readonly destination: Vec3
    }

export interface RejectedOrder {
  readonly recipientId: string
  readonly reason:
    | 'dead-recipient'
    | 'different-faction'
    | 'not-subordinate'
    | 'self-order'
    | 'invalid-destination'
    | 'missing-target'
    | 'dead-target'
    | 'non-hostile-target'
}

export interface IssueSquadOrderInput {
  readonly commander: CommandEntity
  readonly recipients: readonly CommandEntity[]
  readonly order: OrderDraft
  readonly potentialTargets?: readonly CommandEntity[]
}

export interface IssueSquadOrderResult {
  readonly accepted: readonly SoldierOrder[]
  readonly rejected: readonly RejectedOrder[]
}

function isAlive(entity: CommandEntity): boolean {
  return entity.alive ?? true
}

function isFiniteVec3(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function createOrder(
  commanderId: string,
  recipientId: string,
  draft: OrderDraft,
): SoldierOrder {
  if (draft.type === 'attack-target') {
    return { type: draft.type, commanderId, recipientId, targetId: draft.targetId }
  }
  if (draft.type === 'move-to') {
    return { type: draft.type, commanderId, recipientId, destination: { ...draft.destination } }
  }
  return { type: draft.type, commanderId, recipientId }
}

function validateDraft(
  commander: CommandEntity,
  draft: OrderDraft,
  potentialTargets: readonly CommandEntity[],
): RejectedOrder['reason'] | null {
  if (draft.type === 'move-to') {
    return isFiniteVec3(draft.destination) ? null : 'invalid-destination'
  }

  if (draft.type !== 'attack-target') return null

  const target = potentialTargets.find((candidate) => candidate.id === draft.targetId)
  if (!target) return 'missing-target'
  if (!isAlive(target)) return 'dead-target'
  return resolveStance(commander.factionId, target.factionId) === 'hostile'
    ? null
    : 'non-hostile-target'
}

export function issueSquadOrder(input: IssueSquadOrderInput): IssueSquadOrderResult {
  const targetError = validateDraft(input.commander, input.order, input.potentialTargets ?? [])
  const accepted: SoldierOrder[] = []
  const rejected: RejectedOrder[] = []

  for (const recipient of input.recipients) {
    let reason: RejectedOrder['reason'] | null = targetError

    if (!reason && recipient.id === input.commander.id) reason = 'self-order'
    if (!reason && !isAlive(recipient)) reason = 'dead-recipient'
    if (!reason && recipient.factionId !== input.commander.factionId) reason = 'different-faction'
    if (!reason && recipient.commanderId !== input.commander.id) reason = 'not-subordinate'

    if (reason) {
      rejected.push({ recipientId: recipient.id, reason })
    } else {
      accepted.push(createOrder(input.commander.id, recipient.id, input.order))
    }
  }

  return { accepted, rejected }
}
