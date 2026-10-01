import { describe, expect, it } from 'vitest'
import { clampCrop, MAX_ZOOM, panCrop, roundCrop, squareCrop, zoomCrop, zoomOf } from './crop'

const landscape = { width: 1600, height: 900 }

describe('squareCrop', () => {
  it('centres landscape crops', () => {
    expect(squareCrop(1600, 900)).toEqual({ sx: 350, sy: 0, side: 900 })
  })

  it('crops portraits nearer the top, where faces usually are', () => {
    expect(squareCrop(900, 1600)).toEqual({ sx: 0, sy: 175, side: 900 })
  })

  it('keeps square images whole', () => {
    expect(squareCrop(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 })
  })
})

describe('panCrop', () => {
  it('moves the crop opposite to the drag, scaled to the crop size', () => {
    const crop = { sx: 350, sy: 0, side: 900 }
    // Dragging right by a tenth of the view reveals 90px further left.
    expect(panCrop(crop, 0.1, 0, landscape)).toEqual({ sx: 260, sy: 0, side: 900 })
  })

  it('stops at the edges of the image', () => {
    const crop = { sx: 350, sy: 0, side: 900 }
    expect(panCrop(crop, 5, 5, landscape)).toEqual({ sx: 0, sy: 0, side: 900 })
    expect(panCrop(crop, -5, -5, landscape)).toEqual({ sx: 700, sy: 0, side: 900 })
  })
})

describe('zoomCrop', () => {
  it('zooms around the centre by default', () => {
    const crop = { sx: 350, sy: 0, side: 900 }
    expect(zoomCrop(crop, 2, landscape)).toEqual({ sx: 575, sy: 225, side: 450 })
  })

  it('keeps the point under the anchor in place', () => {
    const crop = { sx: 350, sy: 0, side: 900 }
    const anchor = { x: 0.25, y: 0.75 }
    const zoomed = zoomCrop(crop, 1.5, landscape, anchor)
    const pointBefore = [crop.sx + anchor.x * crop.side, crop.sy + anchor.y * crop.side]
    const pointAfter = [zoomed.sx + anchor.x * zoomed.side, zoomed.sy + anchor.y * zoomed.side]
    expect(pointAfter[0]).toBeCloseTo(pointBefore[0])
    expect(pointAfter[1]).toBeCloseTo(pointBefore[1])
  })

  it('stays between the whole image and the maximum zoom', () => {
    const crop = squareCrop(1600, 900)
    expect(zoomOf(zoomCrop(crop, 0.1, landscape), landscape)).toBe(1)
    expect(zoomOf(zoomCrop(crop, 100, landscape), landscape)).toBe(MAX_ZOOM)
  })
})

describe('clampCrop / roundCrop', () => {
  it('pulls a crop back inside the image', () => {
    expect(clampCrop({ sx: -50, sy: 700, side: 2000 }, landscape)).toEqual({
      sx: 0,
      sy: 0,
      side: 900,
    })
  })

  it('rounds to whole pixels without leaving the image', () => {
    expect(roundCrop({ sx: 699.6, sy: 0.4, side: 900.4 }, landscape)).toEqual({
      sx: 700,
      sy: 0,
      side: 900,
    })
  })
})
