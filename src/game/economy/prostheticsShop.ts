import type { InjuryState, Limb } from '../health'
import { canAfford, debit, getBalance } from './currency'
import type { InventoryState } from './inventory'

export type ProstheticKind = 'hand' | 'leg' | 'eye'

export interface ProstheticOffer {
  readonly kind: ProstheticKind
  readonly name: string
  readonly description: string
  readonly price: number
}

export type ProstheticPurchaseFailure =
  | 'not-needed'
  | 'insufficient-funds'
  | 'unknown-prosthetic'

export interface ProstheticPurchaseSuccess {
  readonly ok: true
  readonly limb: Limb
  readonly price: number
  readonly balance: number
  readonly inventory: InventoryState
}

export interface ProstheticPurchaseRejected {
  readonly ok: false
  readonly reason: ProstheticPurchaseFailure
}

export type ProstheticPurchaseResult =
  | ProstheticPurchaseSuccess
  | ProstheticPurchaseRejected

export const PROSTHETIC_OFFERS: readonly ProstheticOffer[] = [
  {
    kind: 'hand',
    name: 'Hand prosthetic',
    description: 'Restores a severed hand slot so weapon and grab gates can trust the injury slice.',
    price: 80,
  },
  {
    kind: 'leg',
    name: 'Leg prosthetic',
    description: 'Restores one severed leg and clears the crawl slowdown when no severed legs remain.',
    price: 120,
  },
  {
    kind: 'eye',
    name: 'Eye patch lens',
    description: 'Restores one lost eye and clears the half-screen blackout when both eyes are intact.',
    price: 60,
  },
] as const

const LIMBS_BY_KIND: Record<ProstheticKind, readonly Limb[]> = {
  hand: ['leftHand', 'rightHand'],
  leg: ['leftLeg', 'rightLeg'],
  eye: ['leftEye', 'rightEye'],
}

export function prostheticOffer(kind: ProstheticKind): ProstheticOffer | undefined {
  return PROSTHETIC_OFFERS.find((offer) => offer.kind === kind)
}

export function limbNeedingProsthetic(injury: InjuryState, kind: ProstheticKind): Limb | null {
  return LIMBS_BY_KIND[kind].find((limb) => injury[limb] === 'severed') ?? null
}

export function canUseProsthetic(injury: InjuryState, kind: ProstheticKind): boolean {
  return limbNeedingProsthetic(injury, kind) !== null
}

export function buyProsthetic(
  inventory: InventoryState,
  injury: InjuryState,
  kind: ProstheticKind,
): ProstheticPurchaseResult {
  const offer = prostheticOffer(kind)
  if (!offer) return { ok: false, reason: 'unknown-prosthetic' }
  const limb = limbNeedingProsthetic(injury, kind)
  if (!limb) return { ok: false, reason: 'not-needed' }
  if (!canAfford(inventory, offer.price)) return { ok: false, reason: 'insufficient-funds' }
  const nextInventory = debit(inventory, offer.price)
  return {
    ok: true,
    limb,
    price: offer.price,
    balance: getBalance(nextInventory),
    inventory: nextInventory,
  }
}
