import { currentLanguage, t } from '../i18n'
import type {
  FamilyGraph,
  FuzzyDate,
  NameForm,
  NameOrder,
  NameParts,
  Person,
  PersonName,
} from './types'

const FUZZY_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

/** Whether text is a year, year-month or full ISO date ("1950", "1950-03", "1950-03-14"). */
export function isFuzzyDate(text: string): text is FuzzyDate {
  return FUZZY_DATE.test(text)
}

/** A one-part name, as most people are entered: "Mary" or "Mary Smith". */
export function simpleName(given: string, surname?: string): PersonName {
  return surname ? { given, surnames: [surname] } : { given }
}

/** The name shown for a person: the first of their names. */
export function displayName(person: Pick<Person, 'names'>): PersonName {
  return person.names[0]
}

export function fullName(person: Pick<Person, 'names'>): string {
  return formatName(displayName(person))
}

/** Hangul, Chinese characters and kana, which are written without spaces between name parts. */
const CJK = /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u

function isCjk(parts: NameParts): boolean {
  const words = [parts.given, ...(parts.surnames ?? []), parts.patronymic ?? '']
  const text = words.join('').replace(/\s/g, '')
  return text !== '' && CJK.test(text)
}

/**
 * How names in other scripts are written, from the settings. The app keeps
 * it in step with what is rendered, as it does the language.
 */
let preferredOrder: NameOrder = 'given-first'

export function setPreferredNameOrder(order: NameOrder): void {
  preferredOrder = order
}

/**
 * Whether a name is written family name first. Names in Korean, Chinese or
 * Japanese script always are (김민준); others follow the settings.
 */
export function nameOrder(name: NameParts): NameOrder {
  return isCjk(name) ? 'family-first' : preferredOrder
}

/** The parts of a name in written order, skipping empty ones. */
function orderedParts(name: NameParts, order: NameOrder): string[] {
  const surnames = name.surnames ?? []
  const parts =
    order === 'family-first'
      ? [...surnames, name.given, name.patronymic]
      : [name.given, name.patronymic, ...surnames]
  return parts.map((part) => part?.trim() ?? '').filter(Boolean)
}

/**
 * A name written out: "Mary Ann Smith", "Ana García López", "Björk
 * Guðmundsdóttir", "김민준". CJK names are written without spaces.
 */
export function formatName(name: PersonName | NameForm, order = nameOrder(name)): string {
  return orderedParts(name, order).join(isCjk(name) ? '' : ' ')
}

/**
 * Up to two letters for an avatar, in written order: "MS" for Mary Smith,
 * "NP" for Nagy Péter. CJK names use the given name instead (민준), as
 * their first characters alone don't read as initials.
 */
export function initials(person: Pick<Person, 'names'>): string {
  const name = displayName(person)
  if (isCjk(name)) return [...name.given.replace(/\s/g, '')].slice(0, 2).join('')
  const family = name.surnames?.find((s) => s.trim()) ?? name.patronymic
  const given = name.given
  const pair = nameOrder(name) === 'family-first' ? [family, given] : [given, family]
  return pair
    .map((part) => [...(part?.trim() ?? '')][0] ?? '')
    .join('')
    .toUpperCase()
}

/**
 * Compares people by name for sorted lists: by surname, then patronymic, then
 * given name, whatever order the names are written in.
 */
export function compareNames(a: Pick<Person, 'names'>, b: Pick<Person, 'names'>): number {
  const collator = new Intl.Collator(currentLanguage(), { sensitivity: 'base' })
  const key = (person: Pick<Person, 'names'>) => {
    const name = displayName(person)
    return [(name.surnames ?? []).join(' '), name.patronymic ?? '', name.given]
  }
  const ka = key(a)
  const kb = key(b)
  for (let i = 0; i < ka.length; i++) {
    const result = collator.compare(ka[i], kb[i])
    if (result !== 0) return result
  }
  return 0
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
  if (age.months !== undefined) return t('age.months', { n: age.months })
  if (age.years === 0) return '<1'
  return age.approximate ? `~${age.years}` : String(age.years)
}

/** "12 June 1988", "June 1988" or "1988", in the reader's language. */
export function formatFuzzyDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, (month ?? 1) - 1, day ?? 1)
  return new Intl.DateTimeFormat(currentLanguage(), {
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
  if (born) return isDeceased(person) ? `${born} – ?` : t('life.bornShort', { year: born })
  if (died) return t('life.diedShort', { year: died })
  return isDeceased(person) ? t('life.deceased') : null
}

/** "1 person" or "12 people"; placeholder parents don't count. */
export function peopleCount(graph: FamilyGraph): string {
  const count = Object.values(graph.people).filter((p) => !p.isPlaceholder).length
  return t('people', { count })
}
