import { describe, expect, it } from 'vitest'
import { lineOfSightClear, type SightObstacle } from './lineOfSight'

const from = { x: 0, y: 0, z: 0 }
const to = { x: 10, y: 0, z: 0 }

describe('lineOfSightClear', () => {
  it('is clear over open ground (no obstacles)', () => {
    expect(lineOfSightClear(from, to, [])).toBe(true)
  })

  it('is blocked by an obstacle straddling the sight line', () => {
    const tree: SightObstacle = { x: 5, z: 0, radius: 1 }
    expect(lineOfSightClear(from, to, [tree])).toBe(false)
  })

  it('is clear when an obstacle sits off to the side', () => {
    const tree: SightObstacle = { x: 5, z: 3, radius: 1 }
    expect(lineOfSightClear(from, to, [tree])).toBe(true)
  })

  it('ignores obstacles behind the viewer (segment, not infinite ray)', () => {
    const behind: SightObstacle = { x: -5, z: 0, radius: 1 }
    expect(lineOfSightClear(from, to, [behind])).toBe(true)
  })

  it('ignores obstacles beyond the target', () => {
    const beyond: SightObstacle = { x: 15, z: 0, radius: 1 }
    expect(lineOfSightClear(from, to, [beyond])).toBe(true)
  })

  it('grazes are caught once padding inflates the radius', () => {
    const grazing: SightObstacle = { x: 5, z: 1.2, radius: 1 }
    expect(lineOfSightClear(from, to, [grazing])).toBe(true)
    expect(lineOfSightClear(from, to, [grazing], 0.5)).toBe(false)
  })

  it('is blocked if any one of several obstacles intersects', () => {
    const obstacles: SightObstacle[] = [
      { x: 3, z: 4, radius: 1 },
      { x: 7, z: 0, radius: 0.5 },
    ]
    expect(lineOfSightClear(from, to, obstacles)).toBe(false)
  })
})
