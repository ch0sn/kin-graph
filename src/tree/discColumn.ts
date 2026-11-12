/**
 * Where the person sheet's action discs sit.
 *
 * They rest in a column just off the card's right edge. The first one lines
 * up with the relationship label, and the rest step down from it. Each disc
 * slides straight out of the card at its own height. `bounce` and `stagger`
 * match the action-node demo at bounce=30 and stagger=35.
 */

/** Disc diameter. Spacing and the air beside the card hang off this. */
export const FAN_DOT = 36
const R = FAN_DOT / 2

/** Centre to centre, so the air between discs stays constant. */
export const FAN_SPACING = FAN_DOT + 12

/** How far the spring is allowed to overshoot, as a fraction of the trip. */
export const FAN_BOUNCE = 30

/** 0 is everything at once, 100 is the longest cascade that still reads as one. */
export const FAN_STAGGER = 35

/** The air between the card and the discs. Fixed, as on the action node. */
export const FAN_REACH = 25

/** The longest a cascade is allowed to take, in ms, at stagger 100. */
const BEAT = 90

/** Extra px inside the card, so a closed disc is fully covered. */
const HIDE_INSET = 4

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Stiffness and decay for one spring, tuned 0..100.
 * 0 arrives with no ring, 100 rebounds twice, 30 is a single soft overshoot.
 */
export function springOf(tune: number): { k: number; d: number } {
  const t = clamp(tune, 0, 100) / 100
  return { k: 0.08 + t * 0.16, d: 0.62 + t * 0.2 }
}

/** Gap between the card's edge and a disc's edge, in px. Reach is 0..100. */
export function gapPx(reach: number): number {
  return 6 + (clamp(reach, 20, 40) / 100) * 24
}

export interface FanPoint {
  x: number
  y: number
  /** Unit direction out of the card, for a label sitting beyond the disc. */
  nx: number
  ny: number
}

/**
 * How far down the card's top-right corner the relationship label sits.
 * A label that has left the layout reports an empty box at the viewport
 * origin. Callers keep the previous offset instead of following that box.
 */
export function labelOffset(
  label: { top: number; width: number; height: number },
  originTop: number,
): number | null {
  if (label.width < 1 || label.height < 1) return null
  return label.top + label.height / 2 - originTop
}

/**
 * Resting places. `lineY` is the relationship label's centre, measured down
 * from the card's top-right corner. +x is right, +y is down.
 */
export function discColumn(count: number, lineY: number): FanPoint[] {
  const x = gapPx(FAN_REACH) + R
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: lineY + i * FAN_SPACING,
    nx: 1,
    ny: 0,
  }))
}

/** Centre x of a closed disc: just inside the card's right edge, fully covered. */
export function discHideX(): number {
  return -(R + HIDE_INSET)
}

/** Delay before button `index` starts, opening first-to-last and closing last-to-first. */
export function fanDelay(index: number, count: number, open: boolean, stagger = FAN_STAGGER): number {
  const gap = (clamp(stagger, 0, 100) / 100) * BEAT
  const place = open ? index : Math.max(count - 1, 0) - index
  return Math.max(0, gap * place)
}
