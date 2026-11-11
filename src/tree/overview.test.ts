import { describe, expect, it } from 'vitest'
import type { Rect } from '@xyflow/react'
import {
  MAX_OVERVIEW_ZOOM,
  MIN_OVERVIEW_ZOOM,
  WHOLE_TREE_GAP,
  treeBounds,
  wholeTreeViewport,
  type Insets,
} from './overview'

const insets: Insets = { top: WHOLE_TREE_GAP, right: WHOLE_TREE_GAP, bottom: WHOLE_TREE_GAP, left: WHOLE_TREE_GAP }

/** Where the tree lands on screen for a viewport. */
function place(bounds: Rect, viewport: { x: number; y: number; zoom: number }) {
  const left = bounds.x * viewport.zoom + viewport.x
  const top = bounds.y * viewport.zoom + viewport.y
  return {
    left,
    top,
    right: left + bounds.width * viewport.zoom,
    bottom: top + bounds.height * viewport.zoom,
  }
}

describe('treeBounds', () => {
  it('spans every node, including its size', () => {
    expect(
      treeBounds([
        { position: { x: 10, y: 20 }, width: 100, height: 40 },
        { position: { x: -5, y: 80 }, width: 10, height: 10 },
      ]),
    ).toEqual({ x: -5, y: 20, width: 115, height: 70 })
  })

  it('is empty when there is nothing to frame', () => {
    expect(treeBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('wholeTreeViewport', () => {
  const wide = { x: 0, y: 0, width: 8000, height: 900 }
  const frame = { width: 1400, height: 900 }

  it('zooms a wide tree out past the old floor so every node is on screen', () => {
    const viewport = wholeTreeViewport(wide, frame, null, insets)
    const box = place(wide, viewport)

    // 0.2 was the canvas floor. At that zoom this tree is wider than the screen.
    expect(viewport.zoom).toBeLessThan(0.2)
    expect(viewport.zoom).toBeGreaterThan(MIN_OVERVIEW_ZOOM)
    expect(box.left).toBeGreaterThanOrEqual(insets.left - 1)
    expect(box.top).toBeGreaterThanOrEqual(insets.top - 1)
    expect(box.right).toBeLessThanOrEqual(frame.width - insets.right + 1)
    expect(box.bottom).toBeLessThanOrEqual(frame.height - insets.bottom + 1)
  })

  it('keeps the tree above a sheet that covers the bottom', () => {
    const bounds = { x: 100, y: 40, width: 2000, height: 500 }
    const sheet = { x: 0, y: 420, width: frame.width, height: 480 }
    const viewport = wholeTreeViewport(bounds, frame, sheet, insets)
    const box = place(bounds, viewport)

    expect(box.bottom).toBeLessThanOrEqual(sheet.y - WHOLE_TREE_GAP + 1)
    expect(box.left).toBeGreaterThanOrEqual(insets.left - 1)
    expect(box.right).toBeLessThanOrEqual(frame.width - insets.right + 1)
  })

  it('puts a tall tree beside a sheet instead of squashing it above', () => {
    const bounds = { x: 0, y: 0, width: 400, height: 2000 }
    const sheet = { x: 0, y: 360, width: 400, height: 540 }
    const viewport = wholeTreeViewport(bounds, frame, sheet, insets)
    const box = place(bounds, viewport)

    expect(box.left).toBeGreaterThanOrEqual(sheet.x + sheet.width + WHOLE_TREE_GAP - 1)
    expect(box.top).toBeGreaterThanOrEqual(insets.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(frame.height - insets.bottom + 1)
  })

  it('frames a wide tree above a sheet that only covers the bottom-left', () => {
    const bounds = { x: 0, y: 0, width: 2000, height: 400 }
    const sheet = { x: 16, y: 480, width: 384, height: 400 }
    const viewport = wholeTreeViewport(bounds, frame, sheet, insets)
    const box = place(bounds, viewport)

    expect(box.bottom).toBeLessThanOrEqual(sheet.y - WHOLE_TREE_GAP + 1)
    expect(box.right).toBeLessThanOrEqual(frame.width - insets.right + 1)
  })

  it('does not zoom a small tree past the canvas maximum', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 80 }
    const viewport = wholeTreeViewport(bounds, frame, null, insets)
    expect(viewport.zoom).toBe(MAX_OVERVIEW_ZOOM)
  })

  it('stops at the floor when the tree cannot fit', () => {
    const bounds = { x: 0, y: 0, width: 1_000_000, height: 1_000_000 }
    const viewport = wholeTreeViewport(bounds, frame, null, insets)
    expect(viewport.zoom).toBe(MIN_OVERVIEW_ZOOM)
  })

  it('still sits above a sheet that leaves only a short strip', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 1200 }
    const phone = { width: 390, height: 700 }
    const sheet = { x: 0, y: 110, width: phone.width, height: 590 }
    const viewport = wholeTreeViewport(bounds, phone, sheet, insets)
    const box = place(bounds, viewport)

    expect(box.bottom).toBeLessThanOrEqual(sheet.y - WHOLE_TREE_GAP + 1)
    expect(box.top).toBeGreaterThanOrEqual(insets.top - 1)
  })

  it('ignores a sheet that does not overlap the canvas', () => {
    const bounds = { x: 0, y: 0, width: 8000, height: 900 }
    const offscreen = { x: 0, y: frame.height + 40, width: 400, height: 300 }
    const clear = wholeTreeViewport(bounds, frame, null, insets)
    const covered = wholeTreeViewport(bounds, frame, offscreen, insets)
    expect(covered).toEqual(clear)
  })
})
