import { isFuzzyDate, type FuzzyDate } from '../model'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "1950-03-14" → "14 MAR 1950", "1950-03" → "MAR 1950", "1950" → "1950". */
export function toGedcomDate(date: FuzzyDate): string {
  const [year, month, day] = date.split('-')
  return [day && String(Number(day)), month && MONTHS[Number(month) - 1], year]
    .filter(Boolean)
    .join(' ')
}

export type ParsedDate =
  | { kind: 'exact'; date: FuzzyDate }
  /** A qualifier such as ABT or BEF was dropped, or a range reduced to its start. */
  | { kind: 'approximate'; date: FuzzyDate }
  /** Phrases, other calendars, BC years and anything else that can't be kept. */
  | { kind: 'unsupported' }

const QUALIFIER = /^(ABT|ABOUT|EST|CAL|BEF|AFT|FROM|TO|INT)\s+/i
const RANGE = /^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+/i
const GREGORIAN = /^@#DGREGORIAN@\s*/i

/** Reads a GEDCOM 5.5.1 date value, keeping what a `FuzzyDate` can hold. */
export function fromGedcomDate(value: string): ParsedDate {
  let text = value.trim().replace(GREGORIAN, '')
  let approximate = false

  const range = RANGE.exec(text)
  if (range) {
    text = range[1]
    approximate = true
  } else if (QUALIFIER.test(text)) {
    text = text.replace(QUALIFIER, '')
    approximate = true
  }

  const date = parseExact(text)
  if (!date) return { kind: 'unsupported' }
  return { kind: approximate ? 'approximate' : 'exact', date }
}

function parseExact(text: string): FuzzyDate | undefined {
  const match = /^(?:(?:(\d{1,2})\s+)?([A-Za-z]{3})\s+)?(\d{3,4})$/.exec(text.trim())
  if (!match) return undefined
  const [, day, monthName, year] = match
  const paddedYear = year.padStart(4, '0')
  if (!monthName) return isFuzzyDate(paddedYear) ? paddedYear : undefined
  const month = MONTHS.indexOf(monthName.toUpperCase()) + 1
  if (month === 0) return undefined
  const parts = [paddedYear, String(month).padStart(2, '0'), day?.padStart(2, '0')]
  const date = parts.filter(Boolean).join('-')
  return isFuzzyDate(date) ? date : undefined
}
