import {
  childIdsOf,
  dateBounds,
  isDeceased,
  isExactDate,
  parseDate,
  partnershipsOf,
  yearOf,
  type FamilyGraph,
  type FuzzyDate,
  type Person,
} from '../model'

/**
 * A life on the timeline, in fractional years. The bar is solid from
 * `solidStart` to `solidEnd` and fades in before and out after, where the
 * dates are uncertain: "about 1905" fades over the years it could be.
 */
export interface LifeSpan {
  start: number
  solidStart: number
  solidEnd: number
  end: number
  /** Still living, so the bar runs to today. */
  living: boolean
  /** Died, but when isn't known: the bar fades out and ends in "?". */
  endUnknown: boolean
}

/** How long a bar fades in before a "before" birth date, or before a death when only that is known. */
const FADE_BEFORE = 25
/** How long a bar takes to firm up after an "after" birth date. */
const FADE_AFTER = 10
/** How long a bar fades out after the last known sign of life, when the death date is unknown. */
const FADE_OUT = 25
/** When only a death date is known, how many years before it the bar starts fading in, and is solid. */
const ONLY_DEATH_START = 80
const ONLY_DEATH_SOLID = 60

/** "1950-07-01" as 1950.5: the year plus how far through it the day is. */
export function fractionalYear(iso: string): number {
  const [year, month = 1, day = 1] = iso.split('-').map(Number)
  return year + (month - 1) / 12 + (day - 1) / 365
}

export function todayYear(today: Date): number {
  return today.getFullYear() + today.getMonth() / 12 + (today.getDate() - 1) / 365
}

/** Where a date could start and end, as years; one end may be open ("before", "after"). */
function yearBounds(date: FuzzyDate): { from?: number; to?: number; exact: boolean } | null {
  const bounds = dateBounds(date)
  if (!bounds) return null
  return {
    from: bounds.from ? fractionalYear(bounds.from) : undefined,
    to: bounds.to ? fractionalYear(bounds.to) : undefined,
    exact: isExactDate(date),
  }
}

/** The last year anything is known to have happened to a person: their events, partnerships and children's births. */
export function lastKnownYear(graph: FamilyGraph, person: Person): number | null {
  const dates = [
    person.birthDate,
    ...graph.events.filter((e) => e.personId === person.id).map((e) => e.date),
    ...partnershipsOf(graph, person.id).flatMap((p) => [p.startDate, p.endDate]),
    ...childIdsOf(graph, person.id).map((id) => graph.people[id]?.birthDate),
  ]
  const years = dates.flatMap((d) => (d && yearOf(d) !== null ? [yearOf(d)!] : []))
  return years.length > 0 ? Math.max(...years) : null
}

/** Where a person's bar runs, or null when neither their birth nor death date is known. */
export function lifeSpan(graph: FamilyGraph, person: Person, today = new Date()): LifeSpan | null {
  const now = todayYear(today)
  const birth = person.birthDate ? yearBounds(person.birthDate) : null
  const death = person.deathDate ? yearBounds(person.deathDate) : null
  if (!birth && !death) return null

  let start: number
  let solidStart: number
  if (birth) {
    const qualifier = parseDate(person.birthDate!)!.qualifier
    if (qualifier === 'before') {
      solidStart = birth.to!
      start = solidStart - FADE_BEFORE
    } else if (qualifier === 'after') {
      start = birth.from!
      solidStart = start + FADE_AFTER
    } else {
      start = birth.from!
      solidStart = birth.exact ? start : birth.to!
    }
  } else {
    const point = death!.from ?? death!.to!
    start = point - ONLY_DEATH_START
    solidStart = point - ONLY_DEATH_SOLID
  }

  let solidEnd: number
  let end: number
  let living = false
  let endUnknown = false
  if (death) {
    const qualifier = parseDate(person.deathDate!)!.qualifier
    if (qualifier === 'before') {
      end = death.to!
      solidEnd = end - FADE_AFTER
    } else if (qualifier === 'after') {
      solidEnd = death.from!
      end = solidEnd + FADE_OUT
    } else {
      solidEnd = death.from!
      end = death.exact ? solidEnd : death.to!
    }
  } else if (isDeceased(person)) {
    solidEnd = Math.max(solidStart, lastKnownYear(graph, person) ?? solidStart)
    end = solidEnd + FADE_OUT
    endUnknown = true
  } else {
    solidEnd = end = now
    living = true
  }

  // Keep the parts in order, and nothing past today.
  end = Math.min(end, now)
  solidEnd = Math.min(Math.max(solidEnd, solidStart), end)
  start = Math.min(start, solidStart)
  return { start, solidStart, solidEnd, end, living, endUnknown }
}

/** Whether someone was alive in a year: certainly, possibly (a faded part of their bar), or not. */
export function aliveIn(span: LifeSpan, year: number): 'yes' | 'maybe' | 'no' {
  const middle = year + 0.5
  if (middle >= span.solidStart && middle <= span.solidEnd) return 'yes'
  if (middle >= span.start && middle <= span.end) return 'maybe'
  return 'no'
}

/** How old someone was in a year: "54", "~70" when the birth date is uncertain, "?" when it isn't known. */
export function ageIn(person: Person, year: number): string | null {
  if (!person.birthDate) return '?'
  const born = yearOf(person.birthDate)
  if (born === null || year < born) return null
  return isExactDate(person.birthDate) ? String(year - born) : `~${year - born}`
}
