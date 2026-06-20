import { describe, expect, it } from 'vitest'
import { streamingReducer, selectIsStreamingLoading, setAssetPhase } from './streamingSlice'

describe('streamingSlice', () => {
  it('tracks per-asset load phases', () => {
    const state = streamingReducer(
      undefined,
      setAssetPhase({ id: 'hero.player-default', phase: 'loading' }),
    )
    expect(state.phases['hero.player-default']).toBe('loading')
    expect(selectIsStreamingLoading({ streaming: state })).toBe(true)
  })

  it('clears loading flag when all assets are idle or loaded', () => {
    let state = streamingReducer(
      undefined,
      setAssetPhase({ id: 'hero.player-default', phase: 'loading' }),
    )
    state = streamingReducer(
      state,
      setAssetPhase({ id: 'hero.player-default', phase: 'loaded' }),
    )
    expect(selectIsStreamingLoading({ streaming: state })).toBe(false)
  })
})
