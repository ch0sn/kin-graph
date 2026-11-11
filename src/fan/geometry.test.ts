import { describe, expect, it } from 'vitest'
import { fitLabel, labelRoom, nameSize, plusSize, ringRadii, sectorPath, slotAngles, yearSize } from './geometry'

describe('slotAngles', () => {
  it('splits each generation evenly, father’s side first', () => {
    expect(slotAngles(1)).toEqual({ a0: 180, a1: 0 })
    expect(slotAngles(2)).toEqual({ a0: 180, a1: 90 })
    expect(slotAngles(3)).toEqual({ a0: 90, a1: 0 })
    expect(slotAngles(5)).toEqual({ a0: 135, a1: 90 })
  })
})

describe('ringRadii', () => {
  it('grows outwards from the centre disc', () => {
    expect(ringRadii(3)).toEqual([0, 80, 175, 280, 385])
  })
})

describe('sectorPath', () => {
  it('draws the outer arc clockwise and the inner one back', () => {
    expect(sectorPath(80, 175, 180, 90)).toBe('M-175 0 A175 175 0 0 1 0 -175 L0 -80 A80 80 0 0 0 -80 0 Z')
  })
})

describe('name sizes', () => {
  it('steps down the shared scale, then stays at 8', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(nameSize)).toEqual([16, 16, 14, 12, 10, 8, 8, 8])
  })

  it('puts years and the bare plus on that same scale', () => {
    expect([16, 14, 12, 10, 8].map(yearSize)).toEqual([12, 10, 8, 8, 8])
    expect([12, 10, 8].map(plusSize)).toEqual([14, 12, 10])
  })
})

describe('labels', () => {
  it('has more room in wide slots than in narrow outer ones', () => {
    const parents = labelRoom(80, 175, 180, 90)
    const great = labelRoom(385, 480, 101.25, 90)
    expect(parents).toBeGreaterThan(great)
  })

  it('steps down from the full name to nothing', () => {
    expect(fitLabel(200, 14, 'Helen Morgan', 'Helen', 'HM')).toBe('full')
    expect(fitLabel(50, 14, 'Helen Morgan', 'Helen', 'HM')).toBe('first')
    expect(fitLabel(20, 14, 'Helen Morgan', 'Helen', 'HM')).toBe('initials')
    expect(fitLabel(5, 14, 'Helen Morgan', 'Helen', 'HM')).toBe('none')
  })
})
