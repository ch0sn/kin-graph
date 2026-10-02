import type { Gender, Person } from '../model'

/** How brothers and sisters are ordered, left to right. */
export type SiblingOrder = 'oldest-first' | 'youngest-first' | 'boys-first' | 'girls-first'

export const SIBLING_ORDERS: readonly SiblingOrder[] = [
  'oldest-first',
  'youngest-first',
  'boys-first',
  'girls-first',
]

export const DEFAULT_SIBLING_ORDER: SiblingOrder = 'oldest-first'

type Compare = (a: Person, b: Person) => number

/**
 * Orders people for the layout. Within each gender group siblings go oldest
 * first; people without a birth date, or without a gender when grouping by
 * gender, come last. Ties keep the order people were added in.
 */
export function compareSiblings(order: SiblingOrder): Compare {
  const byAge = byBirth(order === 'youngest-first' ? -1 : 1)
  if (order !== 'boys-first' && order !== 'girls-first') return byAge

  const ranks: Partial<Record<Gender, number>> =
    order === 'boys-first' ? { male: 0, female: 1 } : { female: 0, male: 1 }
  const rank = (p: Person) => (p.gender ? ranks[p.gender] : undefined) ?? 2
  return (a, b) => rank(a) - rank(b) || byAge(a, b)
}

function byBirth(direction: 1 | -1): Compare {
  return (a, b) => {
    if (!a.birthDate) return b.birthDate ? 1 : 0
    if (!b.birthDate) return -1
    return direction * a.birthDate.localeCompare(b.birthDate)
  }
}
