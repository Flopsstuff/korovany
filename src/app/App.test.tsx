import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import type { AssetLoadPhase } from '../game/streaming/types'
import { appReducer, type AppPhase } from '../store/appSlice'
import { gameReducer } from '../store/gameSlice'
import { streamingReducer } from '../store/streamingSlice'
import { App } from './App'

// Babylon.js needs a real WebGL context, which jsdom does not provide.
// Stub the canvas so the App can render in tests without a GPU. The engine
// bootstrap itself is covered by src/engine/index.test.ts.
vi.mock('../scenes/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}))

function renderApp(
  initialPhase: AppPhase = 'menu',
  streamingPhases: Record<string, AssetLoadPhase> = {},
) {
  const store = configureStore({
    reducer: {
      app: appReducer,
      game: gameReducer,
      streaming: streamingReducer,
    },
    preloadedState: {
      app: { phase: initialPhase },
      game: { score: 0 },
      streaming: { phases: streamingPhases },
    },
  })

  return render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
}

describe('<App />', () => {
  it('renders the menu over the stubbed canvas by default', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Korovany', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Korovany', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('drops the hello-world chrome — no score probe button', () => {
    renderApp()
    expect(screen.queryByRole('button', { name: '+1' })).not.toBeInTheDocument()
  })

  it('hides the menu when starting a new game', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'New Game' }))

    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument()
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('shows and hides the pause overlay with Escape while playing', async () => {
    const user = userEvent.setup()
    renderApp('playing')

    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
  })

  it('does not pause from the main menu when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
  })

  it('shows a loading hint while assets are streaming', () => {
    renderApp('menu', { 'hero.player-default': 'loading' })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
