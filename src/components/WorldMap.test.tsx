import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorldMap } from './WorldMap'
import { listZones } from '../game/world'

const zones = listZones()

describe('WorldMap', () => {
  it('lists all four zones with their owners', () => {
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Human lands')).toBeInTheDocument()
    expect(screen.getByText('Empire')).toBeInTheDocument()
    expect(screen.getByText('Forest')).toBeInTheDocument()
    expect(screen.getByText('Mountains')).toBeInTheDocument()
    expect(screen.getByText('Forest Elves')).toBeInTheDocument()
  })

  it('marks the current zone and disables travelling to it', () => {
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('You are here')).toBeInTheDocument()
    const forest = screen.getByRole('button', { name: /Forest.*You are here/s })
    expect(forest).toBeDisabled()
  })

  it('disables locked zones', () => {
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={vi.fn()} onClose={vi.fn()} />)
    // Only Mountains remains locked now that Empire ships a scene (E8.1 / FLO-427).
    expect(screen.getAllByText('Locked')).toHaveLength(1)
    const mountains = screen.getByRole('button', { name: /Mountains.*Locked/s })
    expect(mountains).toBeDisabled()
  })

  it('lets the player travel to the now-available empire (palace) zone (E8.1)', async () => {
    const onTravel = vi.fn()
    const user = userEvent.setup()
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={onTravel} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Empire/ }))
    await user.click(screen.getByRole('button', { name: 'Travel' }))
    expect(onTravel).toHaveBeenCalledWith('empire')
  })

  it('requires select then confirm before travelling', async () => {
    const onTravel = vi.fn()
    const user = userEvent.setup()
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={onTravel} onClose={vi.fn()} />)

    // Selecting a zone does not travel yet.
    await user.click(screen.getByRole('button', { name: /Human lands/ }))
    expect(onTravel).not.toHaveBeenCalled()

    // Confirming does.
    await user.click(screen.getByRole('button', { name: 'Travel' }))
    expect(onTravel).toHaveBeenCalledWith('human-lands')
  })

  it('can cancel a pending selection', async () => {
    const onTravel = vi.fn()
    const user = userEvent.setup()
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={onTravel} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Human lands/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Travel' })).not.toBeInTheDocument()
    expect(onTravel).not.toHaveBeenCalled()
  })

  it('shows the loading state while travelling', () => {
    render(
      <WorldMap
        zones={zones}
        currentZoneId="forest"
        status="loading"
        onTravel={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Travelling…')).toBeInTheDocument()
  })

  it('shows the error state when travel fails', () => {
    render(
      <WorldMap
        zones={zones}
        currentZoneId="forest"
        status="error"
        onTravel={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/Travel failed/)
  })

  it('renders an empty state when there are no zones', () => {
    render(<WorldMap zones={[]} currentZoneId="forest" onTravel={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/No zones are available/)).toBeInTheDocument()
  })

  it('closes via the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<WorldMap zones={zones} currentZoneId="forest" onTravel={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close world map' }))
    expect(onClose).toHaveBeenCalled()
  })
})
