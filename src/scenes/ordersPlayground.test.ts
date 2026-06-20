import { NullEngine, Scene } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { createOrdersPlayground } from './ordersPlayground'

describe('createOrdersPlayground', () => {
  it('creates a dev scene with commander, squad, and target', () => {
    const game = createOrdersPlayground(document.createElement('canvas'), {
      createEngine: () => new NullEngine(),
    })

    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.soldiers).toHaveLength(2)
    expect(game.currentOrders.size).toBe(2)

    game.dispose()
    expect(game.scene.isDisposed).toBe(true)
  })
})
