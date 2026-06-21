import { describe, expect, it } from 'vitest'
import { mix, renderClip, renderTone } from './synth'
import { renderSfx } from './sfx'

const SR = 44100

describe('renderTone', () => {
  it('produces a buffer of the requested duration', () => {
    const pcm = renderTone({ freq: 440, duration: 0.1 }, SR)
    expect(pcm.length).toBe(Math.floor(0.1 * SR))
  })

  it('always returns at least one sample', () => {
    expect(renderTone({ freq: 440, duration: 0 }, SR).length).toBe(1)
  })

  it('keeps samples within the unit range', () => {
    const pcm = renderTone({ freq: 220, duration: 0.2, gain: 1 }, SR)
    for (const s of pcm) expect(Math.abs(s)).toBeLessThanOrEqual(1)
  })

  it('decays toward silence by the end of the clip', () => {
    const pcm = renderTone({ freq: 440, duration: 0.3, decay: 0.05 }, SR)
    const tail = pcm.slice(-100)
    const peak = Math.max(...Array.from(tail, Math.abs))
    expect(peak).toBeLessThan(0.05)
  })

  it('is deterministic for noise (seeded PRNG)', () => {
    const a = renderTone({ type: 'noise', freq: 0, duration: 0.05 }, SR)
    const b = renderTone({ type: 'noise', freq: 0, duration: 0.05 }, SR)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('mix', () => {
  it('soft-clips summed layers into [-1, 1]', () => {
    const loud = new Float32Array([5, -5, 0.5])
    const mixed = mix([loud, loud])
    for (const s of mixed) expect(Math.abs(s)).toBeLessThanOrEqual(1)
  })

  it('returns a buffer as long as the longest layer', () => {
    const mixed = mix([new Float32Array(10), new Float32Array(25)])
    expect(mixed.length).toBe(25)
  })
})

describe('renderClip', () => {
  it('layers multiple voices into one clip', () => {
    const clip = renderClip(
      [
        { freq: 200, duration: 0.1 },
        { freq: 400, duration: 0.05 },
      ],
      SR,
    )
    expect(clip.length).toBe(Math.floor(0.1 * SR))
    expect(clip.some((s) => s !== 0)).toBe(true)
  })
})

describe('footstep sound', () => {
  it('produces a valid PCM buffer', () => {
    const clip = renderSfx('footstep', SR)
    expect(clip.length).toBeGreaterThan(0)
    expect(clip.every((s) => Math.abs(s) <= 1)).toBe(true)
  })

  it('is deterministic', () => {
    const a = renderSfx('footstep', SR)
    const b = renderSfx('footstep', SR)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('forestAmbience sound', () => {
  it('produces a valid PCM buffer (~6 seconds)', () => {
    const clip = renderSfx('forestAmbience', SR)
    expect(clip.length).toBeGreaterThan(0)
    expect(clip.every((s) => Math.abs(s) <= 1)).toBe(true)
  })

  it('is deterministic', () => {
    const a = renderSfx('forestAmbience', SR)
    const b = renderSfx('forestAmbience', SR)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
