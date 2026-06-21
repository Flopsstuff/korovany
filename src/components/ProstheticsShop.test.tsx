import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInjuryState, severLimb } from '../game/health'
import { ProstheticsShop } from './ProstheticsShop'

describe('<ProstheticsShop />', () => {
  it('renders the empty state when no prosthetic is needed', () => {
    render(
      <ProstheticsShop
        injury={createInjuryState()}
        goldBalance={200}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('No prosthetics needed. Every tracked limb is intact.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit hand' })).toBeDisabled()
  })

  it('disables unaffordable repairs with gold-piece units', () => {
    render(
      <ProstheticsShop
        injury={severLimb(createInjuryState(), 'leftLeg')}
        goldBalance={30}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Balance: 30 gold pieces')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit leg' })).toBeDisabled()
    expect(screen.getByText('Need 90 more gold pieces')).toBeInTheDocument()
  })

  it('calls onBuy for an affordable matching prosthetic', async () => {
    const user = userEvent.setup()
    const onBuy = vi.fn()
    render(
      <ProstheticsShop
        injury={severLimb(createInjuryState(), 'leftEye')}
        goldBalance={60}
        onBuy={onBuy}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Fit eye' }))

    expect(onBuy).toHaveBeenCalledWith('eye')
  })

  it('renders loading and error states', () => {
    const { rerender } = render(
      <ProstheticsShop
        injury={createInjuryState()}
        goldBalance={0}
        status="loading"
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Loading prosthetics…')).toBeInTheDocument()

    rerender(
      <ProstheticsShop
        injury={createInjuryState()}
        goldBalance={0}
        status="error"
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Prosthetics inventory failed to load.')
  })
})
