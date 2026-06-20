import { Scene } from './Scene'
import { addScore, useAppDispatch, useAppSelector } from './store'

export function App() {
  const score = useAppSelector((state) => state.game.score)
  const dispatch = useAppDispatch()

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 720,
        margin: '0 auto',
        padding: '2rem 1rem',
      }}
    >
      <h1>Korovany</h1>
      <p>3D action game / browser SPA — hello world.</p>
      <p>
        Stack: TypeScript · React · Babylon.js · Redux Toolkit. Deployed to Cloudflare Pages via
        GitHub Actions.
      </p>

      <Scene />

      <p style={{ marginTop: '1rem' }}>
        Score (Redux): <strong>{score}</strong>{' '}
        <button onClick={() => dispatch(addScore(1))}>+1</button>
      </p>
    </main>
  )
}
