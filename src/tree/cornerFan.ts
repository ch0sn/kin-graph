/**
 * Where a card's actions sit when they fan out of its top-right corner.
 *
 * The path is the one Bencho's action node uses (MIT,
 * https://bencho.dev/blocks/action-node): an offset of the card's own
 * outline, so every button stays the same distance from the card whether
 * the corner is square or round. Buttons start under the corner and travel
 * out along that path. `bounce` and `stagger` match the action-node demo
 * at bounce=30 and stagger=35.
 */

/** Disc diameter. Spacing, the hiding place and the air all hang off this. */
export const FAN_DOT = 36
const R = FAN_DOT / 2

/** Centre to centre along the path, so the air between discs stays constant. */
export const FAN_SPACING = FAN_DOT + 12

/** How far the spring is allowed to overshoot, as a fraction of the trip. */
export const FAN_BOUNCE = 30

/** 0 is everything at once, 100 is the longest cascade that still reads as one. */
export const FAN_STAGGER = 35

/** The air between the card and the discs. Fixed, as on the action node. */
export const FAN_REACH = 25

/** The longest a cascade is allowed to take, in ms, at stagger 100. */
const BEAT = 90

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
 * A point `s` px along the offset outline, measured from where the corner
 * arc meets the top edge. Negative runs left along the top; past the arc
 * runs down the right edge. The origin is the card's top-right corner,
 * +x right, +y down.
 */
export function ride(s: number, corner: number, off: number): FanPoint {
  const arc = Math.max(0.001, corner + off)
  const len = (arc * Math.PI) / 2
  if (s <= 0) return { x: -corner + s, y: -off, nx: 0, ny: -1 }
  if (s >= len) return { x: off, y: corner + (s - len), nx: 1, ny: 0 }
  const th = Math.PI / 2 - s / arc
  return {
    x: -corner + arc * Math.cos(th),
    y: corner - arc * Math.sin(th),
    nx: Math.cos(th),
    ny: -Math.sin(th),
  }
}

/**
 * How far inside the corner a disc must sit to be fully hidden.
 * Returned as a diagonal distance from the sharp corner.
 */
export function hideAt(corner: number): number {
  return corner >= R + 2
    ? corner * Math.SQRT2
    : Math.max(R * Math.SQRT2 + 2, corner * Math.SQRT2 + corner + 2)
}

/** The point under the card every disc folds back to. */
export function hidePoint(corner: number): { x: number; y: number } {
  const deep = hideAt(corner) / Math.SQRT2
  return { x: -deep, y: deep }
}

/** Resting places, centred on the corner and running from the top edge downward. */
export function fanSpots(count: number, corner: number): FanPoint[] {
  const c = clamp(corner, 0, 40)
  const off = gapPx(FAN_REACH) + R
  const mid = ((c + off) * Math.PI) / 4
  return Array.from({ length: count }, (_, i) => ride(mid + (i - (count - 1) / 2) * FAN_SPACING, c, off))
}

/** Delay before button `index` starts, opening first-to-last and closing last-to-first. */
export function fanDelay(index: number, count: number, open: boolean, stagger = FAN_STAGGER): number {
  const gap = (clamp(stagger, 0, 100) / 100) * BEAT
  const place = open ? index : Math.max(count - 1, 0) - index
  return Math.max(0, gap * place)
}

/**
 * The card's top-right radius, in px. An elliptical corner uses its
 * tighter side so the arc stays inside the curve. Capped so a theme
 * with a huge radius cannot throw the fan off the card.
 */
export function cornerRadius(raw: string, max = 40): number {
  const parts = raw
    .split(/[\s/]+/)
    .map((part) => parseFloat(part))
    .filter((n) => Number.isFinite(n) && n >= 0)
  if (parts.length === 0) return 16
  return clamp(Math.min(...parts), 0, max)
}
