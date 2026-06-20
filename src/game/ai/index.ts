export type {
  SoldierFSMParams,
  SoldierFSMState,
  SoldierOrderContext,
  SoldierPhase,
  SoldierStepResult,
} from './soldierFSM'
export {
  applyDamageToSoldier,
  createSoldierFSM,
  DEFAULT_SOLDIER_PARAMS,
  stepSoldierFSM,
} from './soldierFSM'

export {
  issueSquadOrder,
  type CommandEntity,
  type IssueSquadOrderInput,
  type IssueSquadOrderResult,
  type OrderDraft,
  type OrderType,
  type RejectedOrder,
  type SoldierOrder,
} from './orders'

export type {
  CaravanFSMParams,
  CaravanFSMState,
  CaravanPhase,
  CaravanStepResult,
  Waypoint,
} from './caravanFSM'
export {
  applyDamageToCaravan,
  createCaravanFSM,
  DEFAULT_CARAVAN_PARAMS,
  stepCaravanFSM,
} from './caravanFSM'
