import { describe, expect, it } from 'vitest'
import {
  FAN_BOUNCE,
  FAN_DOT,
  FAN_REACH,
  FAN_SPACING,
  FAN_STAGGER,
  discColumn,
  discHideX,
  fanDelay,
  labelOffset,
  gapPx,
  springOf,
} from './discColumn'

const R = FAN_DOT / 2

describe('disc column', () => {
  it('tunes bounce 30 to a single soft overshoot', () => {
    const { k, d } = springOf(FAN_BOUNCE)
    expect(k).toBeCloseTo(0.128)
    expect(d).toBeCloseTo(0.68)
    // zeta = -ln(d) / (2 * sqrt(k)); under 1 rings, over about 0.5 rings once.
    const zeta = -Math.log(d) / (2 * Math.sqrt(k))
    expect(zeta).toBeGreaterThan(0.45)
    expect(zeta).toBeLessThan(0.65)
  })

  it('keeps a fixed gap between the card and the discs', () => {
    expect(gapPx(FAN_REACH)).toBeCloseTo(12)
  })

  it('staggers 35 as a short cascade, and folds the last one back first', () => {
    expect(fanDelay(0, 5, true, FAN_STAGGER)).toBe(0)
    expect(fanDelay(1, 5, true, FAN_STAGGER)).toBeCloseTo(31.5)
    expect(fanDelay(4, 5, true, FAN_STAGGER)).toBeCloseTo(126)
    expect(fanDelay(4, 5, false, FAN_STAGGER)).toBe(0)
    expect(fanDelay(0, 5, false, FAN_STAGGER)).toBeCloseTo(126)
  })

  it('stacks the discs down the right edge from the relationship label', () => {
    const spots = discColumn(5, 42)
    expect(spots).toHaveLength(5)
    for (const spot of spots) {
      expect(spot.x).toBeCloseTo(gapPx(FAN_REACH) + R)
      expect(spot.nx).toBe(1)
      expect(spot.ny).toBe(0)
    }
    expect(spots[0].y).toBeCloseTo(42)
    for (let i = 1; i < spots.length; i++) {
      expect(spots[i].y - spots[i - 1].y).toBeCloseTo(FAN_SPACING)
    }
  })

  it('keeps the column beside the card when the label has left the layout', () => {
    expect(labelOffset({ top: 520, width: 48, height: 16 }, 491)).toBeCloseTo(37)
    // A detached label reports a zero box at the viewport origin.
    expect(labelOffset({ top: 0, width: 0, height: 0 }, 390)).toBeNull()
  })

  it('hides a closed disc fully inside the right edge', () => {
    expect(discHideX() + R).toBeLessThan(0)
  })
})
