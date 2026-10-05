import { currentLanguage, t } from '../i18n'
import type { FuzzyDate } from './types'

/**
 * Dates are strings. A plain date is ISO-8601 at year, month or day
 * precision ("1950", "1950-03", "1950-03-14"), and may carry a qualifier:
 *
 *   "~1890"       about
 *   "<1920"       before
 *   ">1920"       after
 *   "1910/1915"   between (a range; both ends are plain dates)
 *
 * Plain dates are exactly what older versions stored, so nothing migrates.
 */
const PLAIN = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

export type DateQualifier = 'exact' | 'about' | 'before' | 'after' | 'range'

export interface ParsedDate {
  qualifier: DateQualifier
  /** The date, or the first of a range. */
  start: string
  /** The second date of a range. */
  end?: string
}

/** A year, year-month or full date without a qualifier. */
export function isPlainDate(text: string): boolean {
  return PLAIN.test(text)
}

/** Reads a date string, or null when it isn't one. A range must run forwards. */
export function parseDate(text: string): ParsedDate | null {
  if (isPlainDate(text)) return { qualifier: 'exact', start: text }
  const prefix = { '~': 'about', '<': 'before', '>': 'after' } as const
  const lead = text[0]
  if (lead === '~' || lead === '<' || lead === '>') {
    const rest = text.slice(1)
    return isPlainDate(rest) ? { qualifier: prefix[lead], start: rest } : null
  }
  const parts = text.split('/')
  if (parts.length === 2 && isPlainDate(parts[0]) && isPlainDate(parts[1])) {
    const [start, end] = parts
    return earliest(start) <= latest(end) ? { qualifier: 'range', start, end } : null
  }
  return null
}

/** Whether text is a date: plain, qualified or a range. */
export function isFuzzyDate(text: string): text is FuzzyDate {
  return parseDate(text) !== null
}

/** Puts a date string together; the inverse of `parseDate`. */
export function buildDate({ qualifier, start, end }: ParsedDate): FuzzyDate {
  switch (qualifier) {
    case 'exact':
      return start
    case 'about':
      return `~${start}`
    case 'before':
      return `<${start}`
    case 'after':
      return `>${start}`
    case 'range':
      return `${start}/${end ?? start}`
  }
}

/** The first day a plain date could mean: "1950-03" → "1950-03-01". */
function earliest(plain: string): string {
  const [year, month = '01', day = '01'] = plain.split('-')
  return `${year}-${month}-${day}`
}

/** The last day a plain date could mean: "1950-02" → "1950-02-28". */
function latest(plain: string): string {
  const [year, month = '12', day] = plain.split('-')
  if (day) return plain
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`
}

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * The days a date could fall on, inclusive, as ISO days. Open ends ("before",
 * "after") are bounded only on one side, and "about" stretches `ABOUT_YEARS` either way.
 */
export function dateBounds(date: FuzzyDate): { from?: string; to?: string } | null {
  const parsed = parseDate(date)
  if (!parsed) return null
  switch (parsed.qualifier) {
    case 'before':
      return { to: shiftDay(earliest(parsed.start), -1) }
    case 'after':
      return { from: shiftDay(latest(parsed.start), 1) }
    case 'range':
      return { from: earliest(parsed.start), to: latest(parsed.end!) }
    case 'about':
      return {
        from: earliest(shiftYear(parsed.start, -ABOUT_YEARS)),
        to: latest(shiftYear(parsed.start, ABOUT_YEARS)),
      }
    default:
      return { from: earliest(parsed.start), to: latest(parsed.start) }
  }
}

/** How far either way "about" may stretch when deciding whether one date is certainly before another. */
export const ABOUT_YEARS = 5

function shiftYear(plain: string, years: number): string {
  return String(Number(plain.slice(0, 4)) + years).padStart(4, '0') + plain.slice(4)
}

/** Whether `a` is certainly earlier than `b`: no day `a` could be is on or after one `b` could be. */
export function isCertainlyBefore(a: FuzzyDate, b: FuzzyDate): boolean {
  const boundsA = dateBounds(a)
  const boundsB = dateBounds(b)
  if (!boundsA?.to || !boundsB?.from) return false
  return boundsA.to < boundsB.from
}

const RANK: Record<DateQualifier, number> = { before: 0, range: 1, about: 2, exact: 3, after: 4 }

/**
 * A deterministic order for dates of any precision, for sorting. Dates sort by
 * where they start; "before 1920" comes ahead of 1920 and "after 1920" behind
 * every day of it. Ties fall back to the qualifier, the end of a range and
 * finally the text, so equal-looking dates never swap places between runs.
 */
export function compareDates(a: FuzzyDate, b: FuzzyDate): number {
  const pa = parseDate(a)
  const pb = parseDate(b)
  if (!pa || !pb) return pa ? -1 : pb ? 1 : 0
  const point = (p: ParsedDate) => (p.qualifier === 'after' ? latest(p.start) : earliest(p.start))
  return (
    cmp(point(pa), point(pb)) ||
    RANK[pa.qualifier] - RANK[pb.qualifier] ||
    cmp(pa.end ? latest(pa.end) : '', pb.end ? latest(pb.end) : '') ||
    cmp(a, b)
  )
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** For sorting lists where some entries have no date: those come last. */
export function compareOptionalDates(a: FuzzyDate | undefined, b: FuzzyDate | undefined): number {
  if (!a) return b ? 1 : 0
  if (!b) return -1
  return compareDates(a, b)
}

/** The year a date is placed in: the first year of a range, the year given otherwise. */
export function yearOf(date: FuzzyDate): number | null {
  const parsed = parseDate(date)
  return parsed ? Number(parsed.start.slice(0, 4)) : null
}

/** Whether the date is exactly as precise as a plain date: no qualifier or range. */
export function isExactDate(date: FuzzyDate): boolean {
  return parseDate(date)?.qualifier === 'exact'
}

/** "12 June 1988", "June 1988" or "1988" for a plain date, in the reader's language. */
export function formatPlainDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(currentLanguage(), {
    year: 'numeric',
    ...(month !== undefined && { month: 'long' }),
    ...(day !== undefined && { day: 'numeric' }),
  }).format(value)
}

/**
 * A date written out in the reader's language: "12 June 1988", "about 1890",
 * "before 1920", "between 1910 and 1915".
 */
export function formatFuzzyDate(date: FuzzyDate): string {
  const parsed = parseDate(date)
  if (!parsed) return date
  const start = formatPlainDate(parsed.start)
  switch (parsed.qualifier) {
    case 'exact':
      return start
    case 'about':
      return t('date.about', { date: start })
    case 'before':
      return t('date.before', { date: start })
    case 'after':
      return t('date.after', { date: start })
    case 'range':
      return t('date.between', { from: start, to: formatPlainDate(parsed.end!) })
  }
}

/** Just the year, compact: "1890", "~1890", "<1920", ">1920", "1910–1915". */
export function formatYear(date: FuzzyDate): string {
  const parsed = parseDate(date)
  if (!parsed) return date
  const year = parsed.start.slice(0, 4)
  switch (parsed.qualifier) {
    case 'exact':
      return year
    case 'about':
      return `~${year}`
    case 'before':
      return `<${year}`
    case 'after':
      return `>${year}`
    case 'range': {
      const endYear = parsed.end!.slice(0, 4)
      return endYear === year ? year : `${year}–${endYear}`
    }
  }
}

/** The pieces of a date as typed into a form, which may be incomplete or invalid. */
export interface DateParts {
  qualifier: DateQualifier
  start: string
  end: string
}

/** Splits date text into its qualifier and dates without checking them. */
export function splitDate(text: string): DateParts {
  const lead = text[0]
  if (lead === '~') return { qualifier: 'about', start: text.slice(1), end: '' }
  if (lead === '<') return { qualifier: 'before', start: text.slice(1), end: '' }
  if (lead === '>') return { qualifier: 'after', start: text.slice(1), end: '' }
  if (text.includes('/')) {
    const [start, end = ''] = text.split('/')
    return { qualifier: 'range', start, end }
  }
  return { qualifier: 'exact', start: text, end: '' }
}

/**
 * Puts typed parts back into date text. Empty when nothing was typed; a
 * half-filled range is kept as typed so validation can point it out.
 */
export function joinDate({ qualifier, start, end }: DateParts): string {
  if (!start && !end) return ''
  switch (qualifier) {
    case 'exact':
      return start
    case 'about':
      return `~${start}`
    case 'before':
      return `<${start}`
    case 'after':
      return `>${start}`
    case 'range':
      return `${start}/${end}`
  }
}

/** Why date text can't be used: not a date at all, or a range that ends before it starts. */
export function dateProblem(text: string): 'invalid' | 'rangeOrder' | null {
  if (parseDate(text)) return null
  const [start, end, ...rest] = text.split('/')
  const backwards = rest.length === 0 && isPlainDate(start) && end !== undefined && isPlainDate(end)
  return backwards ? 'rangeOrder' : 'invalid'
}
