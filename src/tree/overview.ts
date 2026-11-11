import { getViewportForBounds, type Rect, type Viewport } from '@xyflow/react'

/** Lowest zoom that still puts every person on screen. Below this, cards vanish. */
export const MIN_OVERVIEW_ZOOM = 0.02
/** Matches the canvas max, so a small tree fills the screen without going past it. */
export const MAX_OVERVIEW_ZOOM = 1.5
/** Space kept between the tree and the screen edge, and between the tree and the sheet. */
export const WHOLE_TREE_GAP = 28

/** A free patch smaller than this cannot show a tree, so it is not a candidate. */
const MIN_REGION = 40

export interface PlacedNode {
  position: { x: number; y: number }
  width?: number | null
  height?: number | null
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

interface Frame {
  width: number
  height: number
}

/** The rectangle that contains every node, using each node's own size. */
export function treeBounds(nodes: readonly PlacedNode[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const width = node.width ?? 0
    const height = node.height ?? 0
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * A viewport that shows every node inside the part of the screen the person
 * sheet leaves open. The sheet is a rectangle in viewport coordinates. The
 * tree is fitted into whichever open side shows it largest, zooming as far
 * out as it needs to.
 */
export function wholeTreeViewport(
  bounds: Rect,
  frame: Frame,
  obstacle: Rect | null,
  insets: Insets,
): Viewport {
  if (bounds.width <= 0 || bounds.height <= 0 || frame.width <= 0 || frame.height <= 0) {
    return { x: 0, y: 0, zoom: 1 }
  }
  const blocking = obstacle && overlaps(frame, obstacle) ? obstacle : null
  const regions = openRegions(frame, blocking, insets)
  let best: Viewport | null = null
  for (const region of regions) {
    const viewport = getViewportForBounds(bounds, frame.width, frame.height, MIN_OVERVIEW_ZOOM, MAX_OVERVIEW_ZOOM, {
      top: px(region.top),
      right: px(region.right),
      bottom: px(region.bottom),
      left: px(region.left),
    })
    if (!best || viewport.zoom > best.zoom) best = viewport
  }
  return best ?? { x: 0, y: 0, zoom: 1 }
}

function overlaps(frame: Frame, obstacle: Rect): boolean {
  return (
    obstacle.width > 0 &&
    obstacle.height > 0 &&
    obstacle.x < frame.width &&
    obstacle.y < frame.height &&
    obstacle.x + obstacle.width > 0 &&
    obstacle.y + obstacle.height > 0
  )
}

/** Insets of the regions the sheet does not cover, each large enough to use. */
function openRegions(frame: Frame, obstacle: Rect | null, insets: Insets): Insets[] {
  if (!obstacle) {
    const full = region(frame, insets.top, insets.right, insets.bottom, insets.left)
    return full ? [full] : []
  }

  const gap = WHOLE_TREE_GAP
  const regions = [
    // Above the sheet, across the whole width.
    region(frame, insets.top, insets.right, frame.height - obstacle.y + gap, insets.left),
    // Below it.
    region(frame, obstacle.y + obstacle.height + gap, insets.right, insets.bottom, insets.left),
    // To its left, full height.
    region(frame, insets.top, frame.width - obstacle.x + gap, insets.bottom, insets.left),
    // To its right.
    region(frame, insets.top, insets.right, insets.bottom, obstacle.x + obstacle.width + gap),
  ]
  const open = regions.filter((candidate): candidate is Insets => candidate !== null)
  // Nothing usable beside the sheet: fit the canvas anyway, even if the sheet overlaps it.
  if (open.length > 0) return open
  const full = region(frame, insets.top, insets.right, insets.bottom, insets.left)
  return full ? [full] : []
}

function region(frame: Frame, top: number, right: number, bottom: number, left: number): Insets | null {
  if (top < 0 || right < 0 || bottom < 0 || left < 0) return null
  if (frame.width - left - right < MIN_REGION) return null
  if (frame.height - top - bottom < MIN_REGION) return null
  return { top, right, bottom, left }
}

function px(value: number): `${number}px` {
  return `${Math.ceil(value)}px`
}
