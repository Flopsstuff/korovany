import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InventoryPanel } from './InventoryPanel'
import { createInventory, type InventoryState } from '../game/economy'

describe('<InventoryPanel />', () => {
  it('shows the empty state before any loot is picked up', () => {
    render(<InventoryPanel inventory={createInventory()} />)
    expect(screen.getByText('Nothing looted yet.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Inventory: 0 items carried' })).toBeInTheDocument()
  })

  it('titles the panel "Carried" so it does not collide with the score Loot tally', () => {
    render(<InventoryPanel inventory={createInventory()} />)
    expect(screen.getByRole('heading', { name: 'Carried' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Loot' })).not.toBeInTheDocument()
  })

  it('lists carried stacks with their display names and counts', () => {
    const inv: InventoryState = { counts: { gold: 12, grain: 3 }, equippedItemId: null }
    render(<InventoryPanel inventory={inv} />)
    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(screen.getByText('×12')).toBeInTheDocument()
    expect(screen.getByText('Grain')).toBeInTheDocument()
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('marks the equipped item and announces the carried count to assistive tech', () => {
    const inv: InventoryState = { counts: { blade: 1 }, equippedItemId: 'blade' }
    render(<InventoryPanel inventory={inv} />)
    expect(screen.getByLabelText('equipped')).toBeInTheDocument()
    expect(screen.getByText('1 carried, equipped')).toBeInTheDocument()
  })

  it('uses the singular noun in the summary label for a single item', () => {
    const inv: InventoryState = { counts: { gold: 1 }, equippedItemId: null }
    render(<InventoryPanel inventory={inv} />)
    expect(screen.getByRole('region', { name: 'Inventory: 1 item carried' })).toBeInTheDocument()
  })
})
