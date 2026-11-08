import { describe, expect, it } from 'vitest'
import {
  FAN_BOUNCE,
  FAN_DOT,
  FAN_REACH,
  FAN_SPACING,
  FAN_STAGGER,
  cornerRadius,
  fanDelay,
  fanSpots,
  gapPx,
  hideAt,
  hidePoint,
  ride,
  springOf,
} from './cornerFan'

const R = FAN_DOT / 2

describe('corner fan', () => {
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

  it('rides the top edge, the corner arc, then the right edge', () => {
    const corner = 16
    const off = 30
    const alongTop = ride(-20, corner, off)
    expect(alongTop).toMatchObject({ y: -off, nx: 0, ny: -1 })
    expect(alongTop.x).toBeCloseTo(-36)

    const arcStart = ride(0, corner, off)
    expect(arcStart.x).toBeCloseTo(-corner)
    expect(arcStart.y).toBeCloseTo(-off)

    const arc = corner + off
    const len = (arc * Math.PI) / 2
    const arcEnd = ride(len, corner, off)
    expect(arcEnd.x).toBeCloseTo(off)
    expect(arcEnd.y).toBeCloseTo(corner)

    const down = ride(len + 10, corner, off)
    expect(down).toMatchObject({ x: off, nx: 1, ny: 0 })
    expect(down.y).toBeCloseTo(corner + 10)
  })

  it('hides a whole disc inside the corner', () => {
    // A round enough corner hides the disc at the rounding's own centre.
    expect(hideAt(20)).toBeCloseTo(20 * Math.SQRT2)
    // A square corner has no material on the diagonal, so the disc goes further in.
    const square = hideAt(0)
    expect(square).toBeGreaterThan(R * Math.SQRT2)
    const hid = hidePoint(0)
    expect(Math.hypot(hid.x, hid.y)).toBeCloseTo(square)
    expect(hid.x).toBeLessThan(0)
    expect(hid.y).toBeGreaterThan(0)
  })

  it('centres the fan on the corner and spaces it evenly', () => {
    const spots = fanSpots(5, 16)
    expect(spots).toHaveLength(5)
    // The middle disc sits on the outward diagonal.
    expect(spots[2].x).toBeCloseTo(-spots[2].y)
    expect(spots[2].nx).toBeCloseTo(-spots[2].ny)
    // First and last mirror each other across that diagonal.
    expect(spots[0].x).toBeCloseTo(-spots[4].y)
    expect(spots[0].y).toBeCloseTo(-spots[4].x)
    // The cascade runs from the top of the card around to its right side.
    expect(spots[0].y).toBeLessThan(0)
    expect(spots[0].nx).toBe(0)
    expect(spots[4].x).toBeGreaterThan(0)
    expect(spots[4].ny).toBe(0)
    for (let i = 1; i < spots.length; i++) {
      const dx = spots[i].x - spots[i - 1].x
      const dy = spots[i].y - spots[i - 1].y
      // On the straight edges this is exact; across the arc it is a chord, so a little shorter.
      expect(Math.hypot(dx, dy)).toBeGreaterThan(FAN_SPACING * 0.9)
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(FAN_SPACING + 0.01)
    }
  })

  it('reads a corner radius, preferring the tighter side of an ellipse', () => {
    expect(cornerRadius('16px')).toBe(16)
    expect(cornerRadius('18px 225px')).toBe(18)
    expect(cornerRadius('0px')).toBe(0)
    expect(cornerRadius('38px')).toBe(38)
    expect(cornerRadius('255px')).toBe(40)
    expect(cornerRadius('')).toBe(16)
  })
})
