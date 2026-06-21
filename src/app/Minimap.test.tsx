import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Minimap } from './Minimap'
import type { MinimapSnapshot } from '../game/minimap'

const SNAPSHOT: MinimapSnapshot = {
  player: { x: 0, z: 0, rotationY: 0 },
  caravans: [{ x: 100, z: 100 }],
  soldiers: [{ x: -50, z: -50 }],
}

describe('<Minimap>', () => {
  it('renders its canvas during live play', () => {
    render(<Minimap phase="playing" getSnapshot={() => SNAPSHOT} />)
    expect(screen.getByTestId('minimap-canvas')).toBeInTheDocument()
  })

  it('renders nothing in the menu', () => {
    render(<Minimap phase="menu" getSnapshot={() => SNAPSHOT} />)
    expect(screen.queryByTestId('minimap-canvas')).not.toBeInTheDocument()
  })

  it('hides while paused', () => {
    render(<Minimap phase="paused" getSnapshot={() => SNAPSHOT} />)
    expect(screen.queryByTestId('minimap-canvas')).not.toBeInTheDocument()
  })

  it('shows the objective counter when provided', () => {
    render(
      <Minimap phase="playing" getSnapshot={() => SNAPSHOT} objectiveDone={2} objectiveTarget={5} />,
    )
    expect(screen.getByText('Caravans 2/5')).toBeInTheDocument()
  })

  it('clamps the displayed objective count to the target', () => {
    render(
      <Minimap phase="playing" getSnapshot={() => SNAPSHOT} objectiveDone={9} objectiveTarget={5} />,
    )
    expect(screen.getByText('Caravans 5/5')).toBeInTheDocument()
  })
})
