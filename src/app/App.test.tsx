import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import { store } from '../store'
import { App } from './App'

// Babylon.js needs a real WebGL context, which jsdom does not provide.
// Stub the scene so the App can render in tests without a GPU.
vi.mock('../scenes/MainScene', () => ({
  MainScene: () => <div data-testid="main-scene" />,
}))

function renderApp() {
  return render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
}

describe('<App />', () => {
  it('renders the title and the stubbed scene', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Korovany' })).toBeInTheDocument()
    expect(screen.getByTestId('main-scene')).toBeInTheDocument()
  })

  it('increments the Redux score when +1 is clicked', async () => {
    renderApp()
    const user = userEvent.setup()
    const before = store.getState().game.score
    await user.click(screen.getByRole('button', { name: '+1' }))
    expect(store.getState().game.score).toBe(before + 1)
  })
})
