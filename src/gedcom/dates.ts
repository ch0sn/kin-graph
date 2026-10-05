import { isPlainDate, parseDate, type FuzzyDate } from '../model'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/**
 * "1950-03-14" → "14 MAR 1950", "1950-03" → "MAR 1950", "1950" → "1950";
 * "~1890" → "ABT 1890", "<1920" → "BEF 1920", ">1920" → "AFT 1920" and
 * "1910/1915" → "BET 1910 AND 1915".
 */
export function toGedcomDate(date: FuzzyDate): string {
  const parsed = parseDate(date)
  if (!parsed) return date
  const start = plain(parsed.start)
  switch (parsed.qualifier) {
    case 'exact':
      return start
    case 'about':
      return `ABT ${start}`
    case 'before':
      return `BEF ${start}`
    case 'after':
      return `AFT ${start}`
    case 'range':
      return `BET ${start} AND ${plain(parsed.end!)}`
  }
}

function plain(date: string): string {
  const [year, month, day] = date.split('-')
  return [day && String(Number(day)), month && MONTHS[Number(month) - 1], year]
    .filter(Boolean)
    .join(' ')
}

export type ParsedGedcomDate =
  | { kind: 'exact'; date: FuzzyDate }
  /** A qualifier that has no equivalent, such as FROM without TO, was dropped. */
  | { kind: 'approximate'; date: FuzzyDate }
  /** Phrases, other calendars, BC years and anything else that can't be kept. */
  | { kind: 'unsupported' }

const GREGORIAN = /^@#DGREGORIAN@\s*/i
const KEPT: Record<string, '~' | '<' | '>'> = {
  ABT: '~',
  ABOUT: '~',
  EST: '~',
  CAL: '~',
  BEF: '<',
  AFT: '>',
}

/** Reads a GEDCOM 5.5.1 date value, keeping the qualifier and range where KinGraph has one. */
export function fromGedcomDate(value: string): ParsedGedcomDate {
  const text = value.trim().replace(GREGORIAN, '')

  const between = /^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+(.+)$/i.exec(text)
  if (between) {
    const start = parseExact(between[1])
    const end = parseExact(between[2])
    if (!start || !end) return { kind: 'unsupported' }
    const range = parseDate(`${start}/${end}`)
    // A range that runs backwards is kept as its first date.
    return range ? { kind: 'exact', date: `${start}/${end}` } : { kind: 'approximate', date: start }
  }

  const qualified = /^([A-Za-z]+)\s+(.+)$/.exec(text)
  const sign = qualified && KEPT[qualified[1].toUpperCase()]
  if (qualified && sign) {
    const date = parseExact(qualified[2])
    return date ? { kind: 'exact', date: `${sign}${date}` } : { kind: 'unsupported' }
  }

  const lossy = /^(?:FROM|TO|INT)\s+/i
  const date = parseExact(text.replace(lossy, ''))
  if (!date) return { kind: 'unsupported' }
  return { kind: lossy.test(text) ? 'approximate' : 'exact', date }
}

function parseExact(text: string): FuzzyDate | undefined {
  const match = /^(?:(?:(\d{1,2})\s+)?([A-Za-z]{3})\s+)?(\d{3,4})$/.exec(text.trim())
  if (!match) return undefined
  const [, day, monthName, year] = match
  const paddedYear = year.padStart(4, '0')
  if (!monthName) return isPlainDate(paddedYear) ? paddedYear : undefined
  const month = MONTHS.indexOf(monthName.toUpperCase()) + 1
  if (month === 0) return undefined
  const parts = [paddedYear, String(month).padStart(2, '0'), day?.padStart(2, '0')]
  const date = parts.filter(Boolean).join('-')
  return isPlainDate(date) ? date : undefined
}
