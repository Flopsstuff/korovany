import { describe, expect, it } from 'vitest'
import {
  damagePlayer,
  healPlayer,
  healthReducer,
  initHealth,
  selectIsPlayerAlive,
  selectPlayerHp,
} from './healthSlice'
import { DEFAULT_MAX_HP, createHealth } from '../game/health'
import type { SavePayload } from '../game/save'

const save = (hp?: number): SavePayload => ({
  zoneId: 'forest',
  playerPos: { x: 0, y: 0, z: 0 },
  score: 0,
  hp,
  savedAt: 0,
})

describe('healthReducer', () => {
  it('starts at full default health', () => {
    expect(healthReducer(undefined, { type: '@@INIT' })).toEqual(createHealth())
  })

  it('initHealth(null) resets to a full-health default', () => {
    const damaged = createHealth(DEFAULT_MAX_HP, 10)
    expect(healthReducer(damaged, initHealth(null))).toEqual(createHealth())
  })

  it('initHealth restores hp from a save payload', () => {
    expect(healthReducer(undefined, initHealth(save(42)))).toMatchObject({
      currentHp: 42,
      maxHp: DEFAULT_MAX_HP,
      alive: true,
    })
  })

  it('initHealth falls back to full health for a legacy save without hp', () => {
    expect(healthReducer(undefined, initHealth(save()))).toEqual(createHealth())
  })

  it('damagePlayer clamps to 0 and marks death', () => {
    const state = healthReducer(createHealth(DEFAULT_MAX_HP, 30), damagePlayer(999))
    expect(state).toMatchObject({ currentHp: 0, alive: false })
  })

  it('healPlayer clamps to maxHp', () => {
    const state = healthReducer(createHealth(DEFAULT_MAX_HP, 90), healPlayer(50))
    expect(state).toMatchObject({ currentHp: DEFAULT_MAX_HP, alive: true })
  })
})

describe('selectors', () => {
  it('read hp and alive flag from state', () => {
    const health = createHealth(DEFAULT_MAX_HP, 7)
    expect(selectPlayerHp({ health })).toBe(7)
    expect(selectIsPlayerAlive({ health })).toBe(true)
    expect(selectIsPlayerAlive({ health: createHealth(DEFAULT_MAX_HP, 0) })).toBe(false)
  })
})
