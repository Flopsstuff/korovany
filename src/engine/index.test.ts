import { NullEngine, Scene } from '@babylonjs/core'
import { describe, expect, it, vi } from 'vitest'
import { createGameEngine, resizeEngineToDisplay } from './index'

function makeResizable() {
  return { setHardwareScalingLevel: vi.fn(), resize: vi.fn() }
}

describe('resizeEngineToDisplay', () => {
  it('uses a hardware scaling level of 1 on a standard-DPR display', () => {
    const engine = makeResizable()
    resizeEngineToDisplay(engine, 1)
    expect(engine.setHardwareScalingLevel).toHaveBeenCalledWith(1)
    expect(engine.resize).toHaveBeenCalledTimes(1)
  })

  it('uses 1/dpr so retina (dpr=2) renders at full device-pixel resolution', () => {
    const engine = makeResizable()
    resizeEngineToDisplay(engine, 2)
    expect(engine.setHardwareScalingLevel).toHaveBeenCalledWith(0.5)
  })

  it('falls back to dpr=1 when devicePixelRatio is zero or NaN', () => {
    const zero = makeResizable()
    resizeEngineToDisplay(zero, 0)
    expect(zero.setHardwareScalingLevel).toHaveBeenCalledWith(1)

    const nan = makeResizable()
    resizeEngineToDisplay(nan, Number.NaN)
    expect(nan.setHardwareScalingLevel).toHaveBeenCalledWith(1)
  })
})

describe('createGameEngine', () => {
  // jsdom has no WebGL, so inject Babylon's headless NullEngine and skip the
  // GLB load (which would try to fetch). This asserts the bootstrap wires a
  // Scene and that dispose() tears everything down cleanly.
  function boot() {
    const canvas = document.createElement('canvas')
    return createGameEngine(canvas, { streamAssetId: null, createEngine: () => new NullEngine() })
  }

  it('creates a live Scene on the injected engine', () => {
    const game = boot()
    expect(game.scene).toBeInstanceOf(Scene)
    expect(game.scene.isDisposed).toBe(false)
    expect(game.scene.cameras).toHaveLength(1)
    game.dispose()
  })

  it('registers a window resize listener and removes it on dispose', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const game = boot()
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function))
    game.dispose()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    add.mockRestore()
    remove.mockRestore()
  })

  it('disposes the scene cleanly and is idempotent', () => {
    const game = boot()
    game.dispose()
    expect(game.scene.isDisposed).toBe(true)
    expect(() => game.dispose()).not.toThrow()
  })
})
