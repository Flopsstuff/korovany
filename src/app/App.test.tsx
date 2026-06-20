import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthState } from '../game/health'
import { loadLatest, saveGame } from '../game/save'
import { registerPlayer } from '../game/save/playerRuntime'
import type { AssetLoadPhase } from '../game/streaming/types'
import { appReducer, type AppPhase } from '../store/appSlice'
import { DEFAULT_FACTION_STATE, factionReducer } from '../store/factionSlice'
import { gameReducer } from '../store/gameSlice'
import { healthReducer } from '../store/healthSlice'
import { injuryReducer } from '../store/injurySlice'
import { inventoryReducer } from '../store/inventorySlice'
import { createInjuryState } from '../game/health/injuryModel'
import { createInventory, type InventoryState } from '../game/economy'
import { FACTION_IDS } from '../game/faction'
import { DEFAULT_PLAYER_STATE, playerReducer, type PlayerState } from '../store/playerSlice'
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
  player: PlayerState = DEFAULT_PLAYER_STATE,
  health: HealthState = { current: 100, max: 100 },
  inventory: InventoryState = createInventory(),
) {
  const store = configureStore({
    reducer: {
      app: appReducer,
      faction: factionReducer,
      game: gameReducer,
      health: healthReducer,
      injury: injuryReducer,
      inventory: inventoryReducer,
      player: playerReducer,
      streaming: streamingReducer,
    },
    preloadedState: {
      app: { phase: initialPhase },
      faction: DEFAULT_FACTION_STATE,
      game: { score: 0 },
      health: { player: health },
      inventory,
      player,
      streaming: { phases: streamingPhases },
      injury: createInjuryState(),
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
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('disables Continue and shows the empty-state hint when no save exists', () => {
    // jsdom has no IndexedDB, so the save probe fails closed → no save.
    renderApp()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getByText(/No saved game yet/)).toBeInTheDocument()
  })

  it('drops the hello-world chrome — no score probe button', () => {
    renderApp()
    expect(screen.queryByRole('button', { name: '+1' })).not.toBeInTheDocument()
  })

  it('opens the faction picker when starting a new game', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'New Game' }))

    // The landing menu gives way to the faction picker; the game has not started.
    expect(screen.getByRole('heading', { name: 'Choose your faction' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument()
    // No faction chosen yet → the prompt shows and Begin is not offered.
    expect(screen.getByText('Select a faction to begin.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Begin' })).not.toBeInTheDocument()
  })

  it('starts the game after choosing a faction', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'New Game' }))
    await user.click(screen.getByRole('button', { name: /Forest Elves/ }))
    await user.click(screen.getByRole('button', { name: 'Begin' }))

    expect(screen.queryByRole('heading', { name: 'Choose your faction' })).not.toBeInTheDocument()
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument()
  })

  it('returns from the faction picker to the main menu via Back', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'New Game' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.queryByRole('heading', { name: 'Choose your faction' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
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

  it('shows a loading hint while assets are streaming', () => {
    renderApp('menu', { 'hero.player-default': 'loading' })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('returns to menu when player HP reaches 0 during playing', () => {
    renderApp('playing', {}, DEFAULT_PLAYER_STATE, { current: 0, max: 100 })
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument()
  })

  it('shows the health HUD bar while playing with the current HP value', () => {
    renderApp('playing', {}, DEFAULT_PLAYER_STATE, { current: 65, max: 100 })
    const hud = screen.getByRole('group', { name: 'Player health: 65 of 100 hit points' })
    expect(hud).toBeInTheDocument()
    expect(screen.getByText('65/100')).toBeInTheDocument()
  })

  it('hides the health HUD in the main menu', () => {
    renderApp('menu')
    expect(screen.queryByText('100/100')).not.toBeInTheDocument()
  })

  it('shows the inventory panel empty-state while playing with no loot', () => {
    renderApp('playing')
    expect(screen.getByText('Nothing looted yet.')).toBeInTheDocument()
  })

  it('renders carried loot stacks in the HUD inventory panel', () => {
    renderApp('playing', {}, DEFAULT_PLAYER_STATE, { current: 100, max: 100 }, {
      counts: { gold: 14, blade: 1 },
      equippedItemId: 'blade',
    })
    expect(screen.getByText('Gold')).toBeInTheDocument()
    expect(screen.getByText('×14')).toBeInTheDocument()
    expect(screen.getByText('Looted Blade')).toBeInTheDocument()
    expect(screen.queryByText('Nothing looted yet.')).not.toBeInTheDocument()
  })

  it('hides the inventory panel in the main menu', () => {
    renderApp('menu', {}, DEFAULT_PLAYER_STATE, { current: 100, max: 100 }, {
      counts: { gold: 5 },
      equippedItemId: null,
    })
    expect(screen.queryByText('Gold')).not.toBeInTheDocument()
  })

  it('does not bounce to menu on death while paused — combat is frozen (FLO-326)', () => {
    // 0 HP while paused must NOT trigger returnToMenu: the player cannot die on
    // the pause screen. Death is only processed while `playing`.
    renderApp('paused', {}, DEFAULT_PLAYER_STATE, { current: 0, max: 100 })
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument()
  })
})

describe('<App /> save/load (fake-indexeddb)', () => {
  beforeEach(() => {
    ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory()
  })

  afterEach(() => {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
  })

  it('autosaves the live player transform + health on pause', async () => {
    const unregister = registerPlayer({
      read: () => ({ position: { x: 4, y: 1, z: -2 }, rotationY: 1.25 }),
      write: vi.fn(),
    })
    try {
      const user = userEvent.setup()
      renderApp('playing', {}, { zoneId: 'forest' }, { current: 60, max: 120 }, {
        counts: { gold: 14 },
        equippedItemId: null,
      })

      await user.keyboard('{Escape}') // playing → paused triggers autosave

      await waitFor(async () => {
        const saved = await loadLatest()
        expect(saved).not.toBeNull()
        // Structured health round-trips both current and max.
        expect(saved?.health).toEqual({ current: 60, max: 120 })
        expect(saved?.transform.position).toEqual({ x: 4, y: 1, z: -2 })
        expect(saved?.zoneId).toBe('forest')
        // Carried inventory is captured in the autosave snapshot.
        expect(saved?.inventory).toEqual({ counts: { gold: 14 }, equippedItemId: null })
        // The (default neutral) faction is captured too.
        expect(saved?.playerFactionId).toBe(FACTION_IDS.Neutral)
      })
    } finally {
      unregister()
    }
  })

  it('persists the chosen faction into the autosave', async () => {
    const unregister = registerPlayer({
      read: () => ({ position: { x: 0, y: 1, z: 0 }, rotationY: 0 }),
      write: vi.fn(),
    })
    try {
      const user = userEvent.setup()
      renderApp()

      // New Game → pick the Villain → Begin → autosave on pause.
      await user.click(screen.getByRole('button', { name: 'New Game' }))
      await user.click(screen.getByRole('button', { name: /Villain/ }))
      await user.click(screen.getByRole('button', { name: 'Begin' }))
      await user.keyboard('{Escape}')

      await waitFor(async () => {
        const saved = await loadLatest()
        expect(saved?.playerFactionId).toBe(FACTION_IDS.Villain)
      })
    } finally {
      unregister()
    }
  })

  it('enables Continue when a save exists and resumes into the game', async () => {
    await saveGame(
      {
        transform: { position: { x: 7, y: 1, z: 7 }, rotationY: 0 },
        health: { current: 50, max: 100 },
        zoneId: 'forest',
        inventory: { counts: { grain: 3 }, equippedItemId: null },
        playerFactionId: FACTION_IDS.Empire,
      },
      123,
    )

    const write = vi.fn()
    const unregister = registerPlayer({
      read: () => ({ position: { x: 0, y: 0, z: 0 }, rotationY: 0 }),
      write,
    })
    try {
      const user = userEvent.setup()
      renderApp()

      const cont = await screen.findByRole('button', { name: 'Continue' })
      await waitFor(() => expect(cont).toBeEnabled())

      await user.click(cont)

      // Resumed into play: the menu is gone and the live player was teleported.
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument(),
      )
      expect(write).toHaveBeenCalledWith({ position: { x: 7, y: 1, z: 7 }, rotationY: 0 })
    } finally {
      unregister()
    }
  })
})
