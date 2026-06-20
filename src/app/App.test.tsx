import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import type { AssetLoadPhase } from '../game/streaming/types'
import { appReducer, type AppPhase } from '../store/appSlice'
import { gameReducer } from '../store/gameSlice'
import { streamingReducer } from '../store/streamingSlice'
import { saveReducer } from '../store/saveSlice'
import { healthReducer } from '../store/healthSlice'
import { createHealth } from '../game/health'
import { App } from './App'

// Stub IndexedDB save calls so App tests don't touch the real store.
vi.mock('../game/save', () => ({
  hasSave: vi.fn().mockResolvedValue(false),
  readSave: vi.fn().mockResolvedValue(null),
  writeSave: vi.fn().mockResolvedValue(undefined),
  AUTOSAVE_SLOT: 'autosave',
}))

// Babylon.js needs a real WebGL context, which jsdom does not provide.
// Stub the canvas so the App can render in tests without a GPU. The engine
// bootstrap itself is covered by src/engine/index.test.ts.
vi.mock('../scenes/GameCanvas', () => ({
  GameCanvas: () => <div data-testid="game-canvas" />,
}))

function renderApp(
  initialPhase: AppPhase = 'menu',
  streamingPhases: Record<string, AssetLoadPhase> = {},
  health = createHealth(),
) {
  const store = configureStore({
    reducer: {
      app: appReducer,
      game: gameReducer,
      streaming: streamingReducer,
      save: saveReducer,
      health: healthReducer,
    },
    preloadedState: {
      app: { phase: initialPhase },
      game: { score: 0 },
      streaming: { phases: streamingPhases },
      save: { hasSave: false, loadedSave: null },
      health,
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
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quit to Main Menu' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
  })

  it('returns to menu via the Quit button in the pause overlay', async () => {
    const user = userEvent.setup()
    renderApp('paused')

    await user.click(screen.getByRole('button', { name: 'Quit to Main Menu' }))

    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
  })

  it('does not pause from the main menu when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
  })

  it('returns to the menu when the player dies while playing', () => {
    renderApp('playing', {}, createHealth(100, 0))
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Paused' })).not.toBeInTheDocument()
  })

  it('shows a loading hint while assets are streaming', () => {
    renderApp('menu', { 'hero.player-default': 'loading' })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
