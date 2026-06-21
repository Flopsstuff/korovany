import { describe, expect, it } from 'vitest'
import {
  FRAME_BUDGET_MS,
  PERF_BUDGET,
  TARGET_FPS,
  evaluateFrameBudget,
  formatBudgetReport,
  type FrameMetrics,
} from './budget'

/** A frame comfortably inside the default budget. */
const goodFrame: FrameMetrics = {
  fps: 60,
  frameMs: 14,
  drawCalls: 120,
  activeIndices: 800_000,
}

describe('budget constants', () => {
  it('targets 60fps with a ~16.67ms frame', () => {
    expect(TARGET_FPS).toBe(60)
    expect(FRAME_BUDGET_MS).toBeCloseTo(16.666, 2)
    expect(PERF_BUDGET.minFps).toBe(60)
    expect(PERF_BUDGET.maxFrameMs).toBe(FRAME_BUDGET_MS)
  })
})

describe('evaluateFrameBudget', () => {
  it('passes a frame within every limit', () => {
    const report = evaluateFrameBudget(goodFrame)
    expect(report.withinBudget).toBe(true)
    expect(report.violations).toHaveLength(0)
    expect(report.lines).toHaveLength(4)
  })

  it('treats fps as a floor, not a ceiling', () => {
    const slow = evaluateFrameBudget({ ...goodFrame, fps: 45 })
    expect(slow.withinBudget).toBe(false)
    expect(slow.violations.map((v) => v.metric)).toContain('fps')

    const fast = evaluateFrameBudget({ ...goodFrame, fps: 144 })
    expect(fast.withinBudget).toBe(true)
  })

  it('treats frameMs / drawCalls / activeIndices as ceilings', () => {
    const over = evaluateFrameBudget({
      fps: 30,
      frameMs: 33,
      drawCalls: 500,
      activeIndices: 5_000_000,
    })
    expect(over.withinBudget).toBe(false)
    expect(over.violations.map((v) => v.metric).sort()).toEqual([
      'activeIndices',
      'drawCalls',
      'fps',
      'frameMs',
    ])
  })

  it('treats a value exactly at the limit as within budget', () => {
    const report = evaluateFrameBudget({
      fps: PERF_BUDGET.minFps,
      frameMs: PERF_BUDGET.maxFrameMs,
      drawCalls: PERF_BUDGET.maxDrawCalls,
      activeIndices: PERF_BUDGET.maxActiveIndices,
    })
    expect(report.withinBudget).toBe(true)
  })

  it('honours a custom budget', () => {
    const tight = evaluateFrameBudget(goodFrame, {
      minFps: 60,
      maxFrameMs: 16.67,
      maxDrawCalls: 50,
      maxActiveIndices: 100_000,
    })
    expect(tight.withinBudget).toBe(false)
    expect(tight.violations.map((v) => v.metric).sort()).toEqual([
      'activeIndices',
      'drawCalls',
    ])
  })
})

describe('formatBudgetReport', () => {
  it('summarises a passing frame', () => {
    const text = formatBudgetReport(evaluateFrameBudget(goodFrame))
    expect(text).toContain('WITHIN BUDGET')
    expect(text).toContain('fps=60')
  })

  it('flags an over-budget frame', () => {
    const text = formatBudgetReport(
      evaluateFrameBudget({ ...goodFrame, drawCalls: 999 }),
    )
    expect(text).toContain('OVER BUDGET')
    expect(text).toContain('OVER')
  })
})
