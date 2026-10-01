import { describe, expect, it } from 'vitest'
import type { Person } from '../model'
import { compareSiblings, type SiblingOrder } from './siblingOrder'

const people: Person[] = [
  { id: 'max', givenName: 'Max', gender: 'male', birthDate: '2020-08-22' },
  { id: 'lily', givenName: 'Lily', gender: 'female', birthDate: '2016-05-04' },
  { id: 'robin', givenName: 'Robin', birthDate: '2018' },
  { id: 'ella', givenName: 'Ella', gender: 'female', birthDate: '2023' },
  { id: 'sam', givenName: 'Sam', gender: 'male' },
  { id: 'tom', givenName: 'Tom', gender: 'male', birthDate: '2014' },
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
