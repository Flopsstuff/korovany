import { describe, expect, it } from 'vitest'
import { renderSfx, SFX_NAMES } from './sfx'

const LOOP_BEDS = new Set([
  'forestAmbience',
  'humanLandsAmbience',
  'empireAmbience',
  'mountainsAmbience',
])

describe('sfx registry', () => {
  it('exposes the expected named sounds', () => {
    expect(SFX_NAMES).toEqual(
      expect.arrayContaining([
        'hit',
        'kill',
        'playerHurt',
        'attack',
        'uiClick',
        'uiHover',
        'win',
        'lose',
        'footstep',
        'forestAmbience',
        'humanLandsAmbience',
        'empireAmbience',
        'mountainsAmbience',
      ]),
    )
  })

  it.each(SFX_NAMES.filter((n) => !LOOP_BEDS.has(n)))(
    'renders %s to non-empty, in-range PCM',
    (name) => {
      const pcm = renderSfx(name, 44100)
      expect(pcm.length).toBeGreaterThan(0)
      expect(pcm.some((s) => s !== 0)).toBe(true)
      for (const s of pcm) expect(Math.abs(s)).toBeLessThanOrEqual(1)
    },
  )

  it.each([...LOOP_BEDS])('zone bed %s renders to non-empty, in-range PCM', (name) => {
    const pcm = renderSfx(name as (typeof SFX_NAMES)[number], 44100)
    expect(pcm.length).toBeGreaterThan(0)
    expect(pcm.every((s) => Math.abs(s) <= 1)).toBe(true)
  })

  it('scales clip length with the sample rate', () => {
    const lo = renderSfx('hit', 22050)
    const hi = renderSfx('hit', 44100)
    expect(hi.length).toBeGreaterThan(lo.length)
  })
})
