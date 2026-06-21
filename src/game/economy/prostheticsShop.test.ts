import { describe, expect, it } from 'vitest'
import { createInjuryState, hasHalfScreenBlackout, isCrawling, severLimb } from '../health'
import { credit } from './currency'
import { createInventory } from './inventory'
import { buyProsthetic, limbNeedingProsthetic } from './prostheticsShop'

describe('prosthetics shop', () => {
  it('chooses a matching severed limb for each prosthetic kind', () => {
    let injury = createInjuryState()
    injury = severLimb(injury, 'rightHand')
    injury = severLimb(injury, 'leftLeg')
    injury = severLimb(injury, 'rightEye')

    expect(limbNeedingProsthetic(injury, 'hand')).toBe('rightHand')
    expect(limbNeedingProsthetic(injury, 'leg')).toBe('leftLeg')
    expect(limbNeedingProsthetic(injury, 'eye')).toBe('rightEye')
  })

  it('debits gold and returns the limb to fit on success', () => {
    const inventory = credit(createInventory(), 200)
    const injury = severLimb(createInjuryState(), 'leftLeg')

    const result = buyProsthetic(inventory, injury, 'leg')

    expect(result).toMatchObject({
      ok: true,
      limb: 'leftLeg',
      price: 120,
      balance: 80,
      inventory: { counts: { gold: 80 }, equippedItemId: null },
    })
    expect(isCrawling(injury)).toBe(true)
  })

  it('rejects unaffordable prosthetics without overdrawing gold', () => {
    const inventory = credit(createInventory(), 20)
    const injury = severLimb(createInjuryState(), 'leftEye')

    const result = buyProsthetic(inventory, injury, 'eye')

    expect(result).toEqual({ ok: false, reason: 'insufficient-funds' })
    expect(inventory.counts.gold).toBe(20)
    expect(hasHalfScreenBlackout(injury)).toBe(true)
  })

  it('rejects a prosthetic when the matching limb kind is intact', () => {
    const result = buyProsthetic(credit(createInventory(), 200), createInjuryState(), 'hand')

    expect(result).toEqual({ ok: false, reason: 'not-needed' })
  })
})
