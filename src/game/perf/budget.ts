/**
 * Performance budget — the 60fps-on-mid-hardware target (E5.4, FLO-398).
 *
 * Phase 5 spends a lot of CPU on dense forest: thin-instanced vegetation
 * (E5.3) and impostor LOD (E5.1/E5.2) exist to keep the frame inside budget.
 * This module pins down *what the budget is* — as data, not prose — and gives a
 * pure evaluator so a profiler (and tests) can say "this frame is over budget,
 * here is why" without a GL context.
 *
 * ## What "mid hardware" means here
 *
 * The reference machine is a 2019-era integrated-GPU laptop (Intel Iris / entry
 * Apple-silicon class) running the game full-page in a browser tab. The numbers
 * below are deliberately conservative so that a frame which passes the budget on
 * the reference machine has headroom on anything newer.
 *
 * The single hard target is **60fps**, i.e. a **16.67ms** frame. Everything
 * else is a proxy the profiler can read cheaply each frame:
 *
 * - **Draw calls** are the dominant CPU cost in this engine (see
 *   `instancedVegetation.ts`); a few hundred per frame is the comfortable
 *   ceiling for the reference machine's driver overhead.
 * - **Active indices** (3 × triangles actually submitted, post-cull/post-LOD)
 *   bound GPU vertex work; ~1M triangles is the mid-hardware ceiling.
 *
 * These are budgets, not hard limits — exceeding one is a signal to profile,
 * not a crash. Tune against real captures; do not treat the constants as sacred.
 */

/** The frame-rate the game targets on mid hardware. */
export const TARGET_FPS = 60

/** Frame-time budget for {@link TARGET_FPS}, in milliseconds (≈16.67ms). */
export const FRAME_BUDGET_MS = 1000 / TARGET_FPS

/**
 * The performance budget as plain data. A frame is "within budget" when every
 * metric is at or below its ceiling (and fps is at or above its floor).
 */
export interface PerfBudget {
  /** Minimum acceptable frames-per-second. */
  readonly minFps: number
  /** Maximum acceptable mean frame time, in milliseconds. */
  readonly maxFrameMs: number
  /** Maximum draw calls submitted per frame. */
  readonly maxDrawCalls: number
  /** Maximum active indices per frame (≈ 3 × rendered triangles). */
  readonly maxActiveIndices: number
}

/** The default mid-hardware budget (see module docs for the rationale). */
export const PERF_BUDGET: PerfBudget = {
  minFps: TARGET_FPS,
  maxFrameMs: FRAME_BUDGET_MS,
  // Draw-call submission is the CPU bottleneck; thin-instancing keeps a dense
  // forest well under this on the reference machine.
  maxDrawCalls: 300,
  // ~1M triangles rendered after culling and impostor LOD.
  maxActiveIndices: 3_000_000,
}

/** A single frame's measured metrics (whatever a profiler could sample). */
export interface FrameMetrics {
  /** Frames-per-second at sample time. */
  readonly fps: number
  /** Mean frame time over the sample window, in milliseconds. */
  readonly frameMs: number
  /** Draw calls submitted in the sampled frame. */
  readonly drawCalls: number
  /** Active indices rendered in the sampled frame (≈ 3 × triangles). */
  readonly activeIndices: number
}

/** One budget line's verdict. */
export interface BudgetLine {
  /** Which metric this line is about. */
  readonly metric: keyof FrameMetrics
  /** The measured value. */
  readonly value: number
  /** The ceiling (or floor, for fps) the value is checked against. */
  readonly limit: number
  /** True when the value is within budget. */
  readonly ok: boolean
}

/** The verdict for a whole frame. */
export interface BudgetReport {
  /** True when every line is within budget. */
  readonly withinBudget: boolean
  /** Per-metric verdicts, in a stable order. */
  readonly lines: readonly BudgetLine[]
  /** Just the failing lines, for terse logging. */
  readonly violations: readonly BudgetLine[]
}

/**
 * Evaluate measured frame metrics against a budget. Pure arithmetic — no engine,
 * no clock — so it is fully deterministic and unit-testable.
 *
 * fps is a floor (higher is better); everything else is a ceiling.
 */
export function evaluateFrameBudget(
  metrics: FrameMetrics,
  budget: PerfBudget = PERF_BUDGET,
): BudgetReport {
  const lines: BudgetLine[] = [
    { metric: 'fps', value: metrics.fps, limit: budget.minFps, ok: metrics.fps >= budget.minFps },
    {
      metric: 'frameMs',
      value: metrics.frameMs,
      limit: budget.maxFrameMs,
      ok: metrics.frameMs <= budget.maxFrameMs,
    },
    {
      metric: 'drawCalls',
      value: metrics.drawCalls,
      limit: budget.maxDrawCalls,
      ok: metrics.drawCalls <= budget.maxDrawCalls,
    },
    {
      metric: 'activeIndices',
      value: metrics.activeIndices,
      limit: budget.maxActiveIndices,
      ok: metrics.activeIndices <= budget.maxActiveIndices,
    },
  ]
  const violations = lines.filter((l) => !l.ok)
  return { withinBudget: violations.length === 0, lines, violations }
}

/** Human-readable one-line summary of a report (for console / HUD). */
export function formatBudgetReport(report: BudgetReport): string {
  const verdict = report.withinBudget ? 'WITHIN BUDGET' : 'OVER BUDGET'
  const parts = report.lines.map((l) => {
    const cmp = l.metric === 'fps' ? '>=' : '<='
    const flag = l.ok ? 'ok' : 'OVER'
    return `${l.metric}=${round(l.value)} (${cmp}${round(l.limit)} ${flag})`
  })
  return `${verdict}: ${parts.join(', ')}`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
