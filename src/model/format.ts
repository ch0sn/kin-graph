import type { FuzzyDate, Person } from './types'

const FUZZY_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

/** Whether text is a year, year-month or full ISO date ("1950", "1950-03", "1950-03-14"). */
export function isFuzzyDate(text: string): text is FuzzyDate {
  return FUZZY_DATE.test(text)
}

export function fullName(person: Person): string {
  return [person.givenName, person.familyName].filter(Boolean).join(' ')
}

export function initials(person: Pick<Person, 'givenName' | 'familyName'>): string {
  return [person.givenName, person.familyName]
    .map((name) => name?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase()
}

export function isDeceased(person: Person): boolean {
  return person.deceased === true || person.deathDate !== undefined
}

/**
 * "1934 – 2015", "1934 – ?" (died, date unknown), "b. 1988", "d. 1902",
 * "Deceased", or null when nothing is known.
 */
export function lifeYears(person: Person): string | null {
  const born = person.birthDate?.slice(0, 4)
  const died = person.deathDate?.slice(0, 4)
  if (born && died) return `${born} – ${died}`
  if (born) return isDeceased(person) ? `${born} – ?` : `b. ${born}`
  if (died) return `d. ${died}`
  return isDeceased(person) ? 'Deceased' : null
}
