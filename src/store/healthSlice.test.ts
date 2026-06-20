import { describe, expect, it } from 'vitest'
import { damagePlayer, healPlayer, healthReducer, resetPlayerHealth } from './healthSlice'

describe('healthSlice', () => {
  it('boots with full player health (100)', () => {
    const state = healthReducer(undefined, { type: '@@INIT' })
    expect(state.player.current).toBe(100)
    expect(state.player.max).toBe(100)
  })

  it('damagePlayer reduces current HP', () => {
    const s0 = healthReducer(undefined, { type: '@@INIT' })
    const s1 = healthReducer(s0, damagePlayer(30))
    expect(s1.player.current).toBe(70)
  })

  it('damagePlayer clamps at 0', () => {
    const s0 = healthReducer(undefined, { type: '@@INIT' })
    const s1 = healthReducer(s0, damagePlayer(9999))
    expect(s1.player.current).toBe(0)
  })

  it('healPlayer restores HP', () => {
    const s0 = healthReducer(undefined, { type: '@@INIT' })
    const s1 = healthReducer(s0, damagePlayer(50))
    const s2 = healthReducer(s1, healPlayer(20))
    expect(s2.player.current).toBe(70)
  })

  it('healPlayer clamps at max', () => {
    const s0 = healthReducer(undefined, { type: '@@INIT' })
    const s1 = healthReducer(s0, healPlayer(50))
    expect(s1.player.current).toBe(100)
  })

  it('resetPlayerHealth restores full HP', () => {
    const s0 = healthReducer(undefined, { type: '@@INIT' })
    const s1 = healthReducer(s0, damagePlayer(80))
    const s2 = healthReducer(s1, resetPlayerHealth())
    expect(s2.player.current).toBe(100)
  })
})
