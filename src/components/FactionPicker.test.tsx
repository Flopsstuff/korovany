import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PLAYABLE_FACTIONS } from '../game/faction'
import { FactionPicker } from './FactionPicker'

describe('<FactionPicker />', () => {
  it('lists every playable faction with its objectives', () => {
    render(<FactionPicker factions={PLAYABLE_FACTIONS} onConfirm={vi.fn()} onBack={vi.fn()} />)

    for (const faction of PLAYABLE_FACTIONS) {
      const card = screen.getByRole('button', { name: new RegExp(faction.name) })
      for (const objective of faction.objectives) {
        expect(card).toHaveTextContent(objective.summary)
      }
    }
  })

  it('disables Begin until a faction is selected, then confirms with its id', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<FactionPicker factions={PLAYABLE_FACTIONS} onConfirm={onConfirm} onBack={vi.fn()} />)

    // No selection yet → the hint shows and there is no Begin button.
    expect(screen.getByText('Select a faction to begin.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Begin' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Villain/ }))
    await user.click(screen.getByRole('button', { name: 'Begin' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('villain')
  })

  it('clears a selection without confirming', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<FactionPicker factions={PLAYABLE_FACTIONS} onConfirm={onConfirm} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Forest Elves/ }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('button', { name: 'Begin' })).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onBack from the Back button', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<FactionPicker factions={PLAYABLE_FACTIONS} onConfirm={vi.fn()} onBack={onBack} />)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows an empty state when no factions are available', () => {
    render(<FactionPicker factions={[]} onConfirm={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('No playable factions are available yet.')).toBeInTheDocument()
  })

  it('shows a loading state and disables the cards while starting', () => {
    render(
      <FactionPicker factions={PLAYABLE_FACTIONS} status="loading" onConfirm={vi.fn()} onBack={vi.fn()} />,
    )
    expect(screen.getByText('Starting…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Villain/ })).toBeDisabled()
  })
})
