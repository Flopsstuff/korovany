import { type Scene, SceneInstrumentation } from '@babylonjs/core'
import {
  type BudgetReport,
  type FrameMetrics,
  type PerfBudget,
  PERF_BUDGET,
  evaluateFrameBudget,
} from './budget'

/**
 * Frame profiler — samples a scene's per-frame cost and grades it against the
 * {@link PERF_BUDGET} (E5.4, FLO-398).
 *
 * Babylon's {@link SceneInstrumentation} exposes the two numbers the budget
 * cares about cheaply: draw calls submitted and (via the engine) frame time.
 * Active indices come straight off the engine's per-frame counter. The profiler
 * keeps a small rolling window so a single hitched frame does not flip the
 * verdict — what matters for "are we holding 60fps" is the sustained mean.
 *
 * Sampling is injectable (`readMetrics`) so the profiler is unit-testable under
 * `NullEngine` (which renders nothing, so the real instrumentation counters stay
 * at zero) — the default reader wires up real instrumentation for the browser.
 */

/** How a profiler reads one frame's raw metrics. */
export type MetricsReader = () => FrameMetrics

export interface FrameProfilerOptions {
  /** The budget to grade against. Defaults to {@link PERF_BUDGET}. */
  budget?: PerfBudget
  /** Frames to average over (rolling window). Defaults to 60 (~1s at target). */
  windowSize?: number
  /** Override the metrics source (test seam). Defaults to scene instrumentation. */
  readMetrics?: MetricsReader
}

export interface FrameProfiler {
  /** The budget this profiler grades against. */
  readonly budget: PerfBudget
  /**
   * Sample one frame: read raw metrics, fold them into the rolling window, and
   * return the budget verdict for the windowed mean. Call once per rendered
   * frame.
   */
  sample(): BudgetReport
  /** The most recent windowed metrics (mean over the window). */
  current(): FrameMetrics
  /** Stop instrumenting and release resources. */
  dispose(): void
}

/** Default reader: pulls live counters off the scene's instrumentation. */
function instrumentationReader(scene: Scene): { read: MetricsReader; dispose: () => void } {
  const instrumentation = new SceneInstrumentation(scene)
  instrumentation.captureFrameTime = true
  const engine = scene.getEngine()
  const read: MetricsReader = () => ({
    fps: engine.getFps(),
    frameMs: instrumentation.frameTimeCounter.lastSecAverage,
    drawCalls: instrumentation.drawCallsCounter.current,
    activeIndices: scene.getActiveIndices(),
  })
  return { read, dispose: () => instrumentation.dispose() }
}

/**
 * A rolling mean over the last `size` samples, kept as a ring buffer so each
 * sample is O(1) and old frames age out automatically.
 */
class RollingMean {
  private readonly buf: number[] = []
  private sum = 0
  constructor(private readonly size: number) {}
  push(value: number): number {
    this.buf.push(value)
    this.sum += value
    if (this.buf.length > this.size) {
      this.sum -= this.buf.shift() as number
    }
    return this.mean()
  }
  mean(): number {
    return this.buf.length === 0 ? 0 : this.sum / this.buf.length
  }
}

/** Create a frame profiler bound to a scene (or a custom metrics reader). */
export function createFrameProfiler(
  scene: Scene,
  options: FrameProfilerOptions = {},
): FrameProfiler {
  const { budget = PERF_BUDGET, windowSize = 60 } = options

  let readerDispose: (() => void) | undefined
  let read: MetricsReader
  if (options.readMetrics) {
    read = options.readMetrics
  } else {
    const wired = instrumentationReader(scene)
    read = wired.read
    readerDispose = wired.dispose
  }

  const fps = new RollingMean(windowSize)
  const frameMs = new RollingMean(windowSize)
  const drawCalls = new RollingMean(windowSize)
  const activeIndices = new RollingMean(windowSize)
  let last: FrameMetrics = { fps: 0, frameMs: 0, drawCalls: 0, activeIndices: 0 }

  let disposed = false
  return {
    budget,
    sample(): BudgetReport {
      const raw = read()
      last = {
        fps: fps.push(raw.fps),
        frameMs: frameMs.push(raw.frameMs),
        drawCalls: drawCalls.push(raw.drawCalls),
        activeIndices: activeIndices.push(raw.activeIndices),
      }
      return evaluateFrameBudget(last, budget)
    },
    current(): FrameMetrics {
      return last
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      readerDispose?.()
    },
  }
}
