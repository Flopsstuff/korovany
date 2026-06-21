/**
 * Performance budget & profiling (E5.4, FLO-398).
 *
 * - `budget`   — the 60fps-on-mid-hardware budget as data + a pure evaluator.
 * - `profiler` — samples a Babylon scene's per-frame cost and grades it.
 * - `perfHud`  — a dev DOM overlay that renders the budget verdict live.
 */
export {
  TARGET_FPS,
  FRAME_BUDGET_MS,
  PERF_BUDGET,
  evaluateFrameBudget,
  formatBudgetReport,
  type PerfBudget,
  type FrameMetrics,
  type BudgetLine,
  type BudgetReport,
} from './budget'
export {
  createFrameProfiler,
  type FrameProfiler,
  type FrameProfilerOptions,
  type MetricsReader,
} from './profiler'
export { createPerfHud, type PerfHud } from './perfHud'
