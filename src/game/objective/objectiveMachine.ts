/**
 * The win/lose state machine (MPG.1).
 *
 * A pure decision function with no Redux, React, or Babylon dependency so the
 * core game loop — "is this run still going, won, or lost?" — is exhaustively
 * unit-testable. The App layer feeds it live progress each frame and drives the
 * `appSlice` phase from the result.
 *
 * Death takes priority over victory: a run can only be won while the player is
 * still alive (the moment the objective completes the sim freezes on the win
 * screen, so a post-victory death never reaches here in practice — but the
 * ordering keeps the function total and unambiguous).
 */
export type RunOutcome = 'playing' | 'won' | 'lost'

export interface RunProgress {
  /** Caravans raided so far this run. */
  caravansRaided: number
  /** Caravans required to win. */
  target: number
  /** Player HP has reached zero. */
  playerDead: boolean
}

export function evaluateOutcome(progress: RunProgress): RunOutcome {
  if (progress.playerDead) return 'lost'
  if (progress.caravansRaided >= progress.target) return 'won'
  return 'playing'
}
