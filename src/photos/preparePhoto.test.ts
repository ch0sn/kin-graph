import { describe, expect, it } from 'vitest'
import { squareCrop } from './preparePhoto'

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
