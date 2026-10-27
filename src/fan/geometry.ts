import { generationOf } from './pedigree'

/**
 * Fan chart geometry, in SVG units with the centre at (0, 0) and y pointing
 * down. Angles are in degrees, counter-clockwise from the right as in maths;
 * the fan is drawn clockwise from `start`, so the father's side (the lower
 * slot numbers) comes first: on the left of a half circle.
 */
export interface FanShape {
  start: number
  span: number
}

export const HALF_CIRCLE: FanShape = { start: 180, span: 180 }

/** The radius of the centre person's disc. */
export const CENTRE_RADIUS = 80
/** How thick each generation's ring is, parents first; deeper rings repeat the last. */
const RING_WIDTHS = [95, 105, 105, 95, 80, 70, 60]

/** Where each ring starts and ends: `radii[g]` to `radii[g + 1]` for generation g ≥ 1. */
export function ringRadii(generations: number): number[] {
  const radii = [0, CENTRE_RADIUS]
  for (let g = 1; g <= generations; g++) {
    radii.push(radii[g] + RING_WIDTHS[Math.min(g - 1, RING_WIDTHS.length - 1)])
  }
  return radii
}

/** The angles a slot covers, from `a0` clockwise to `a1` (so `a1` < `a0`). */
export function slotAngles(index: number, shape: FanShape = HALF_CIRCLE): { a0: number; a1: number } {
  const generation = generationOf(index)
  const step = shape.span / 2 ** generation
  const a0 = shape.start - (index - 2 ** generation) * step
  return { a0, a1: a0 - step }
}

export function polar(radius: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: radius * Math.cos(rad), y: -radius * Math.sin(rad) }
}

const round = (n: number) => Math.round(n * 100) / 100

/** An SVG path for the ring segment between radii r0 and r1, from angle a0 clockwise to a1. */
export function sectorPath(r0: number, r1: number, a0: number, a1: number): string {
  const large = a0 - a1 > 180 ? 1 : 0
  const p0 = polar(r1, a0)
  const p1 = polar(r1, a1)
  const p2 = polar(r0, a1)
  const p3 = polar(r0, a0)
  const pt = ({ x, y }: { x: number; y: number }) => `${round(x)} ${round(y)}`
  return (
    `M${pt(p0)} A${r1} ${r1} 0 ${large} 1 ${pt(p1)} L${pt(p2)} ` +
    (r0 > 0 ? `A${r0} ${r0} 0 ${large} 0 ${pt(p3)} Z` : 'Z')
  )
}

/**
 * How wide a horizontal label in a ring segment can be. Along the ring there
 * is the arc's length; across it, the ring's width. A label leaning with the
 * ring uses whichever its angle makes it run into first.
 */
export function labelRoom(r0: number, r1: number, a0: number, a1: number): number {
  const mid = ((a0 + a1) / 2) * (Math.PI / 180)
  const arc = (((r0 + r1) / 2) * Math.abs(a0 - a1) * Math.PI) / 180
  const across = r1 - r0
  const along = Math.abs(Math.sin(mid))
  const out = Math.abs(Math.cos(mid))
  return Math.min(along > 0.01 ? arc / along : Infinity, out > 0.01 ? across / out : Infinity) - 12
}

/** A rough width for text, enough to decide whether it fits. */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.56
}

export type LabelFit = 'full' | 'first' | 'initials' | 'none'

/**
 * The most of a name that fits in `room`: the whole name, the first name, the
 * initials, or nothing (the tooltip still has it).
 */
export function fitLabel(room: number, fontSize: number, full: string, first: string, initials: string): LabelFit {
  if (textWidth(full, fontSize) <= room) return 'full'
  if (textWidth(first, fontSize) <= room) return 'first'
  if (textWidth(initials, fontSize) <= room && room > fontSize) return 'initials'
  return 'none'
}

/** Name size for each generation, parents first. */
export function nameSize(generation: number): number {
  return [17, 17, 14, 12, 10, 9, 8, 8][generation] ?? 8
}
