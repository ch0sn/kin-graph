import { describe, expect, it } from 'vitest'
import type { Person } from '../model'
import { compareSiblings, type SiblingOrder } from './siblingOrder'

const people: Person[] = [
  { id: 'max', names: [{ given: 'Max' }], gender: 'male', birthDate: '2020-08-22' },
  { id: 'lily', names: [{ given: 'Lily' }], gender: 'female', birthDate: '2016-05-04' },
  { id: 'robin', names: [{ given: 'Robin' }], birthDate: '2018' },
  { id: 'ella', names: [{ given: 'Ella' }], gender: 'female', birthDate: '2023' },
  { id: 'sam', names: [{ given: 'Sam' }], gender: 'male' },
  { id: 'tom', names: [{ given: 'Tom' }], gender: 'male', birthDate: '2014' },
]

const order = (siblingOrder: SiblingOrder) =>
  [...people].sort(compareSiblings(siblingOrder)).map((p) => p.id)

describe('compareSiblings', () => {
  it('puts the oldest first by default, undated last', () => {
    expect(order('oldest-first')).toEqual(['tom', 'lily', 'robin', 'max', 'ella', 'sam'])
  })

  it('can put the youngest first, still with undated last', () => {
    expect(order('youngest-first')).toEqual(['ella', 'max', 'robin', 'lily', 'tom', 'sam'])
  })

  it('groups boys first, then girls, then others, each oldest first', () => {
    expect(order('boys-first')).toEqual(['tom', 'max', 'sam', 'lily', 'ella', 'robin'])
  })

  it('groups girls first, then boys, then others, each oldest first', () => {
    expect(order('girls-first')).toEqual(['lily', 'ella', 'tom', 'max', 'sam', 'robin'])
  })
})

describe('compareSiblings with uncertain dates', () => {
  const sorted = (birthDates: string[]) =>
    birthDates
      .map((birthDate, i): Person => ({ id: String(i), names: [{ given: 'X' }], birthDate }))
      .sort(compareSiblings('oldest-first'))
      .map((p) => p.birthDate)

  it('places them by where they start, the same whatever order they arrive in', () => {
    const dates = ['1950', '~1950', '<1950', '>1950', '1948/1952', '1949']
    const expected = ['1948/1952', '1949', '<1950', '~1950', '1950', '>1950']
    expect(sorted(dates)).toEqual(expected)
    expect(sorted([...dates].reverse())).toEqual(expected)
  })
})
