import type { FamilyGraph, FuzzyDate, Person } from './types'

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

export interface Age {
  years: number
  /** Set for babies under a year old, when the full birth date is known. */
  months?: number
  /** Only the birth year (or month) is known, so the birthday may still be ahead. */
  approximate: boolean
}

/**
 * How old a living person is today, or the age someone who has died reached.
 * Null when the birth date, or a death date for someone who has died, isn't
 * known.
 */
export function ageOf(person: Person, today = new Date()): Age | null {
  if (!person.birthDate) return null
  if (isDeceased(person)) {
    return person.deathDate ? ageBetween(person.birthDate, person.deathDate) : null
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  return ageBetween(person.birthDate, now)
}

/** Whole years between two dates, as precisely as the less precise one allows. */
function ageBetween(from: FuzzyDate, to: FuzzyDate): Age | null {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)

  let years = toYear - fromYear
  let approximate = false
  if (fromMonth === undefined || toMonth === undefined) approximate = true
  else if (toMonth < fromMonth) years--
  else if (toMonth === fromMonth) {
    if (fromDay === undefined || toDay === undefined) approximate = true
    else if (toDay < fromDay) years--
  }
  if (years < 0) return null

  if (years === 0 && fromDay !== undefined && toDay !== undefined) {
    const months = (toYear - fromYear) * 12 + toMonth - fromMonth - (toDay < fromDay ? 1 : 0)
    return { years, months, approximate: false }
  }
  return { years, approximate }
}

/** "38", "~38" when approximate, "5 mo" for babies, "<1" when only the year is known. */
export function formatAge(age: Age): string {
  if (age.months !== undefined) return `${age.months} mo`
  if (age.years === 0) return '<1'
  return age.approximate ? `~${age.years}` : String(age.years)
}

/** "12 June 1988", "June 1988" or "1988", in the reader's language. */
export function formatFuzzyDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    ...(month !== undefined && { month: 'long' }),
    ...(day !== undefined && { day: 'numeric' }),
  }).format(value)
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

/** "1 person" or "12 people"; placeholder parents don't count. */
export function peopleCount(graph: FamilyGraph): string {
  const count = Object.values(graph.people).filter((p) => !p.isPlaceholder).length
  return count === 1 ? '1 person' : `${count} people`
}
