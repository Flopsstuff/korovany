import { beforeEach, describe, expect, it, vi } from 'vitest'
import { audioBus } from './audioBus'
import {
  onUiClick,
  playUiClick,
  playUiHover,
  resetUiHoverCooldownForTests,
} from './uiCues'

describe('uiCues', () => {
  beforeEach(() => {
    resetUiHoverCooldownForTests()
    vi.spyOn(audioBus, 'play').mockImplementation(() => {})
  })

  it('playUiClick routes to the uiClick SFX', () => {
    playUiClick()
    expect(audioBus.play).toHaveBeenCalledWith('uiClick')
  })

  it('playUiHover routes to the uiHover SFX', () => {
    playUiHover()
    expect(audioBus.play).toHaveBeenCalledWith('uiHover')
  })

  it('playUiHover respects the cooldown window', () => {
    playUiHover()
    playUiHover()
    expect(audioBus.play).toHaveBeenCalledTimes(1)
  })

  it('onUiClick plays the cue then runs the handler', () => {
    const handler = vi.fn()
    onUiClick(handler)()
    expect(audioBus.play).toHaveBeenCalledWith('uiClick')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('onUiClick still plays when no handler is passed', () => {
    onUiClick()()
    expect(audioBus.play).toHaveBeenCalledWith('uiClick')
  })
})
