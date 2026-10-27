import { describe, expect, it } from 'vitest'
import { addChild, createGraph } from '../model/graph'
import type { FamilyGraph, Person } from '../model/types'
import { aliveIn, ageIn, fractionalYear, lifeSpan } from './spans'

const today = new Date(2026, 9, 27)
const graph: FamilyGraph = createGraph({ names: [{ given: 'Alex' }] })
const person = (fields: Partial<Person>): Person => ({ id: 'x', names: [{ given: 'X' }], ...fields })
const span = (fields: Partial<Person>, g = graph) => lifeSpan(g, person(fields), today)

describe('fractionalYear', () => {
  it('places a day within its year', () => {
    expect(fractionalYear('1950')).toBe(1950)
    expect(fractionalYear('1950-07-01')).toBe(1950.5)
  })
})

describe('lifeSpan', () => {
  it('is solid between exact dates', () => {
    expect(span({ birthDate: '1934', deathDate: '2015' })).toMatchObject({
      start: 1934,
      solidStart: 1934,
      solidEnd: 2015,
      end: 2015,
      living: false,
    })
  })

  it('fades in over the years an "about" birth could be', () => {
    const s = span({ birthDate: '~1905', deathDate: '1980' })!
    expect(s.start).toBe(1900)
    expect(Math.round(s.solidStart)).toBe(1911)
  })

  it('fades in up to a "before" date, and firms up after an "after" one', () => {
    const before = span({ birthDate: '<1920', deathDate: '1990' })!
    expect([Math.round(before.start), Math.round(before.solidStart)]).toEqual([1895, 1920])
    const after = span({ birthDate: '>1920', deathDate: '1990' })!
    expect([Math.round(after.start), Math.round(after.solidStart)]).toEqual([1921, 1931])
  })

  it('fades across a range', () => {
    const s = span({ birthDate: '1910/1915', deathDate: '1990' })!
    expect([s.start, Math.round(s.solidStart)]).toEqual([1910, 1916])
  })

  it('runs to today for the living', () => {
    const s = span({ birthDate: '1988' })!
    expect(s.living).toBe(true)
    expect(s.end).toBeCloseTo(2026.8, 1)
  })

  it('fades out after the last known event when the death date is unknown', () => {
    let g = graph
    const parent = { id: 'p', names: [{ given: 'Frank' }], birthDate: '1898', deceased: true } as Person
    g = { ...g, people: { ...g.people, p: parent } }
    g = addChild(g, 'p', { names: [{ given: 'Helen' }], birthDate: '1932' }).graph
    const s = lifeSpan(g, parent, today)!
    expect(s).toMatchObject({ solidEnd: 1932, end: 1957, endUnknown: true })
  })

  it('starts well before death when only the death date is known', () => {
    expect(span({ deathDate: '1950' })).toMatchObject({ start: 1870, solidStart: 1890, solidEnd: 1950 })
  })

  it('has nothing to draw without dates', () => {
    expect(span({ deceased: true })).toBeNull()
  })
})

describe('aliveIn and ageIn', () => {
  it('tells certain from possible', () => {
    const s = span({ birthDate: '~1905', deathDate: '1980' })!
    expect(aliveIn(s, 1950)).toBe('yes')
    expect(aliveIn(s, 1902)).toBe('maybe')
    expect(aliveIn(s, 1981)).toBe('no')
  })

  it('writes ages as precisely as the birth date allows', () => {
    expect(ageIn(person({ birthDate: '1934' }), 1988)).toBe('54')
    expect(ageIn(person({ birthDate: '~1900' }), 1975)).toBe('~75')
    expect(ageIn(person({ deathDate: '1950' }), 1940)).toBe('?')
    expect(ageIn(person({ birthDate: '1990' }), 1980)).toBeNull()
  })
})
