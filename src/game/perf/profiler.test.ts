import { NullEngine, Scene } from '@babylonjs/core'
import { describe, expect, it } from 'vitest'
import { type FrameMetrics } from './budget'
import { createFrameProfiler } from './profiler'

function boot() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  return { engine, scene }
}

/** A scripted metrics reader that yields each frame in turn, repeating the last. */
function scriptedReader(frames: FrameMetrics[]) {
  let i = 0
  return () => frames[Math.min(i++, frames.length - 1)]
}

describe('createFrameProfiler', () => {
  it('grades the windowed mean against the budget', () => {
    const { scene } = boot()
    const profiler = createFrameProfiler(scene, {
      readMetrics: scriptedReader([
        { fps: 60, frameMs: 14, drawCalls: 100, activeIndices: 500_000 },
      ]),
    })
    const report = profiler.sample()
    expect(report.withinBudget).toBe(true)
    expect(profiler.current().drawCalls).toBe(100)
    profiler.dispose()
  })

  it('averages over the rolling window so a single hitch does not flip the verdict', () => {
    const { scene } = boot()
    const good: FrameMetrics = { fps: 60, frameMs: 14, drawCalls: 100, activeIndices: 500_000 }
    const hitch: FrameMetrics = { fps: 60, frameMs: 14, drawCalls: 100_000, activeIndices: 500_000 }
    const profiler = createFrameProfiler(scene, {
      windowSize: 10,
      readMetrics: scriptedReader([good, good, good, good, hitch]),
    })
    profiler.sample() // good
    profiler.sample() // good
    profiler.sample() // good
    const beforeHitch = profiler.sample() // good — mean draw calls 100, within budget
    expect(beforeHitch.withinBudget).toBe(true)
    // mean draw calls now = (100*4 + 100000)/5 = 20080, well over the 300 ceiling
    const afterHitch = profiler.sample()
    expect(profiler.current().drawCalls).toBeCloseTo((100 * 4 + 100_000) / 5, 0)
    expect(afterHitch.withinBudget).toBe(false)
    expect(afterHitch.violations.map((v) => v.metric)).toContain('drawCalls')
    profiler.dispose()
  })

  it('ages old samples out of the window', () => {
    const { scene } = boot()
    const profiler = createFrameProfiler(scene, {
      windowSize: 2,
      readMetrics: scriptedReader([
        { fps: 60, frameMs: 14, drawCalls: 100, activeIndices: 0 },
        { fps: 60, frameMs: 14, drawCalls: 200, activeIndices: 0 },
        { fps: 60, frameMs: 14, drawCalls: 300, activeIndices: 0 },
      ]),
    })
    profiler.sample() // [100]      -> mean 100
    profiler.sample() // [100,200]  -> mean 150
    profiler.sample() // [200,300]  -> mean 250 (100 aged out)
    expect(profiler.current().drawCalls).toBe(250)
    profiler.dispose()
  })

  it('works under NullEngine with the default instrumentation reader', () => {
    const { scene } = boot()
    const profiler = createFrameProfiler(scene)
    // NullEngine renders nothing, so counters stay at 0 — drawCalls=0 is within
    // budget; the point is that wiring real instrumentation does not throw.
    const report = profiler.sample()
    expect(report.lines.map((l) => l.metric)).toEqual([
      'fps',
      'frameMs',
      'drawCalls',
      'activeIndices',
    ])
    expect(() => profiler.dispose()).not.toThrow()
  })
})
