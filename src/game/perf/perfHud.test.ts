import { describe, expect, it } from 'vitest'
import { evaluateFrameBudget } from './budget'
import { createPerfHud } from './perfHud'

const within = evaluateFrameBudget({
  fps: 60,
  frameMs: 14,
  drawCalls: 100,
  activeIndices: 500_000,
})
const over = evaluateFrameBudget({
  fps: 30,
  frameMs: 33,
  drawCalls: 999,
  activeIndices: 9_000_000,
})

describe('createPerfHud', () => {
  it('mounts into the parent and renders one row per budget line', () => {
    const parent = document.createElement('div')
    const hud = createPerfHud(parent)
    hud.update(within)

    expect(parent.querySelector('[data-testid="perf-hud"]')).toBe(hud.element)
    const rows = hud.element.querySelector('[data-testid="perf-hud-body"]')!.children
    expect(rows).toHaveLength(within.lines.length)
    hud.dispose()
  })

  it('shows the OK header for a frame within budget', () => {
    const parent = document.createElement('div')
    const hud = createPerfHud(parent)
    hud.update(within)
    const header = hud.element.querySelector('[data-testid="perf-hud-header"]')!
    expect(header.textContent).toContain('OK')
    hud.dispose()
  })

  it('flips the header to OVER BUDGET when any line fails', () => {
    const parent = document.createElement('div')
    const hud = createPerfHud(parent)
    hud.update(over)
    const header = hud.element.querySelector('[data-testid="perf-hud-header"]')!
    expect(header.textContent).toContain('OVER BUDGET')
    hud.dispose()
  })

  it('re-renders on each update without leaking rows', () => {
    const parent = document.createElement('div')
    const hud = createPerfHud(parent)
    hud.update(within)
    hud.update(over)
    const rows = hud.element.querySelector('[data-testid="perf-hud-body"]')!.children
    expect(rows).toHaveLength(over.lines.length)
    hud.dispose()
  })

  it('removes itself from the DOM on dispose', () => {
    const parent = document.createElement('div')
    const hud = createPerfHud(parent)
    hud.dispose()
    expect(parent.querySelector('[data-testid="perf-hud"]')).toBeNull()
  })
})
