import { type BudgetReport } from './budget'

/**
 * Performance HUD — a tiny DOM overlay that renders a {@link BudgetReport}
 * (E5.4, FLO-398).
 *
 * Pure DOM (no Babylon, no React) so it is jsdom-testable and drops onto any
 * scene's canvas container. Each line shows a metric, its windowed value and its
 * limit, coloured green within budget / red over. The header flips to red when
 * any line is over, so a glance tells you whether the frame is holding 60fps.
 *
 * This is a *developer* overlay (used by the `?dev=perf` bench), not the
 * player-facing graphics-quality UI — that is E6.4.
 */

const OK_COLOR = '#7CFC8A'
const OVER_COLOR = '#FF6B6B'

export interface PerfHud {
  /** The overlay root element (already appended to the parent). */
  readonly element: HTMLElement
  /** Re-render the overlay from a fresh report. */
  update(report: BudgetReport): void
  /** Remove the overlay from the DOM. */
  dispose(): void
}

/** Create and mount a perf HUD into `parent` (defaults to `document.body`). */
export function createPerfHud(parent: HTMLElement = document.body): PerfHud {
  const element = document.createElement('div')
  element.dataset.testid = 'perf-hud'
  Object.assign(element.style, {
    position: 'absolute',
    top: '8px',
    left: '8px',
    padding: '8px 10px',
    font: '12px/1.4 monospace',
    color: '#fff',
    background: 'rgba(0,0,0,0.6)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '1000',
    whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>)

  const header = document.createElement('div')
  header.dataset.testid = 'perf-hud-header'
  header.style.fontWeight = 'bold'
  header.style.marginBottom = '4px'
  element.appendChild(header)

  const body = document.createElement('div')
  body.dataset.testid = 'perf-hud-body'
  element.appendChild(body)

  parent.appendChild(element)

  let disposed = false
  return {
    element,
    update(report: BudgetReport): void {
      header.textContent = report.withinBudget ? '● 60fps OK' : '● OVER BUDGET'
      header.style.color = report.withinBudget ? OK_COLOR : OVER_COLOR
      body.replaceChildren()
      for (const line of report.lines) {
        const row = document.createElement('div')
        const cmp = line.metric === 'fps' ? '≥' : '≤'
        row.textContent = `${line.metric.padEnd(13)} ${fmt(line.value)} ${cmp} ${fmt(line.limit)}`
        row.style.color = line.ok ? OK_COLOR : OVER_COLOR
        body.appendChild(row)
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      element.remove()
    },
  }
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-US')
}
