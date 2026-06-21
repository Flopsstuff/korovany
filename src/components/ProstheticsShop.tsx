import { useMemo } from 'react'
import { onUiClick, uiHoverProps } from '../game/audio'
import {
  PROSTHETIC_OFFERS,
  canUseProsthetic,
  limbNeedingProsthetic,
  type ProstheticKind,
  type ProstheticPurchaseFailure,
} from '../game/economy'
import type { InjuryState } from '../game/health'

export type ProstheticsShopStatus = 'ready' | 'loading' | 'error'

export interface ProstheticsShopProps {
  readonly injury: InjuryState
  readonly goldBalance: number
  readonly status?: ProstheticsShopStatus
  readonly message?: string | null
  readonly onBuy: (kind: ProstheticKind) => void
  readonly onClose: () => void
}

const FAILURE_COPY: Record<ProstheticPurchaseFailure, string> = {
  'not-needed': 'That prosthetic is not needed right now.',
  'insufficient-funds': 'Not enough gold pieces.',
  'unknown-prosthetic': 'That prosthetic is not stocked.',
}

export function prostheticFailureMessage(reason: ProstheticPurchaseFailure): string {
  return FAILURE_COPY[reason]
}

function limbLabel(kind: ProstheticKind, injury: InjuryState): string {
  const limb = limbNeedingProsthetic(injury, kind)
  if (!limb) return 'No injury'
  if (limb === 'leftHand') return 'Left hand'
  if (limb === 'rightHand') return 'Right hand'
  if (limb === 'leftLeg') return 'Left leg'
  if (limb === 'rightLeg') return 'Right leg'
  if (limb === 'leftEye') return 'Left eye'
  return 'Right eye'
}

export function ProstheticsShop({
  injury,
  goldBalance,
  status = 'ready',
  message = null,
  onBuy,
  onClose,
}: ProstheticsShopProps) {
  const needsRepair = useMemo(
    () => PROSTHETIC_OFFERS.some((offer) => canUseProsthetic(injury, offer.kind)),
    [injury],
  )

  return (
    <section
      className="prosthetics-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prosthetics-title"
    >
      <div className="prosthetics-panel">
        <header className="prosthetics-header">
          <div>
            <p className="prosthetics-kicker">Safe-area service</p>
            <h2 id="prosthetics-title">Prosthetics shop</h2>
          </div>
          <button
            type="button"
            className="prosthetics-close"
            onClick={onUiClick(onClose)}
            aria-label="Close prosthetics shop"
            {...uiHoverProps()}
          >
            Close
          </button>
        </header>

        <p className="prosthetics-balance">Balance: {goldBalance} gold pieces</p>

        {status === 'loading' ? <p className="prosthetics-status">Loading prosthetics…</p> : null}
        {status === 'error' ? (
          <p className="prosthetics-error" role="alert">
            Prosthetics inventory failed to load.
          </p>
        ) : null}
        {status === 'ready' && !needsRepair ? (
          <p className="prosthetics-empty">No prosthetics needed. Every tracked limb is intact.</p>
        ) : null}

        {status === 'ready' ? (
          <ul className="prosthetics-list" aria-label="Prosthetics for sale">
            {PROSTHETIC_OFFERS.map((offer) => {
              const needed = canUseProsthetic(injury, offer.kind)
              const affordable = goldBalance >= offer.price
              const disabled = !needed || !affordable
              return (
                <li className="prosthetics-item" key={offer.kind}>
                  <div>
                    <h3>{offer.name}</h3>
                    <p>{offer.description}</p>
                    <span className="prosthetics-target">{limbLabel(offer.kind, injury)}</span>
                  </div>
                  <div className="prosthetics-buy">
                    <span>{offer.price} gold pieces</span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-disabled={disabled}
                      onClick={onUiClick(() => onBuy(offer.kind))}
                      {...uiHoverProps()}
                    >
                      Fit {offer.kind}
                    </button>
                    {!needed ? <small>Not needed</small> : null}
                    {needed && !affordable ? <small>Need {offer.price - goldBalance} more gold pieces</small> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {message ? (
          <p className="prosthetics-message" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
