import { COUNTRY_CODES } from './countryCodes'
import { foldMarks } from './speak'

/** Extra ways a country turns up in a written place. */
const ALIASES: readonly [string, string][] = [
  ['USA', 'US'],
  ['U.S.A.', 'US'],
  ['U.S.', 'US'],
  ['United States of America', 'US'],
  ['UK', 'GB'],
  ['U.K.', 'GB'],
  ['Great Britain', 'GB'],
  ['Britain', 'GB'],
  ['Czech Republic', 'CZ'],
  ['Russia', 'RU'],
  ['Russian Federation', 'RU'],
  ['Holland', 'NL'],
  ['The Netherlands', 'NL'],
  ['Republic of Korea', 'KR'],
]

const NAME_LANGUAGES = ['en', 'de', 'es', 'ko'] as const

export interface ParsedPlace {
  /** ISO 3166-1 alpha-2, or empty when the text didn't name a country. */
  country: string
  city: string
}

/** A flag emoji for an ISO country code. */
export function flagEmoji(code: string): string {
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ''
  return [...upper].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join('')
}

/** The country's name in `language`, or the code when the language has none. */
export function countryName(code: string, language: string): string {
  const upper = code.toUpperCase()
  if (!upper) return ''
  try {
    const name = new Intl.DisplayNames([language], { type: 'region' }).of(upper)
    return name && name.toUpperCase() !== upper ? name : upper
  } catch {
    return upper
  }
}

let nameToCode: Map<string, string> | null = null

/** Folded country name or code → ISO code. An empty value means two countries share the name. */
function countryNames(): Map<string, string> {
  if (nameToCode) return nameToCode
  const map = new Map<string, string>()
  const claim = (name: string, code: string) => {
    const key = foldMarks(name)
    if (!key) return
    const existing = map.get(key)
    if (existing === undefined) map.set(key, code)
    else if (existing !== code) map.set(key, '')
  }
  for (const code of COUNTRY_CODES) {
    claim(code, code)
    for (const language of NAME_LANGUAGES) claim(countryName(code, language), code)
  }
  for (const [alias, code] of ALIASES) claim(alias, code)
  nameToCode = map
  return map
}

function countryCode(name: string): string {
  return countryNames().get(foldMarks(name.trim())) ?? ''
}

/**
 * Splits a written place into a country and a city. "Berlin, Germany",
 * "Berlin, Deutschland" and "Berlin, DE" all read back. Text that doesn't
 * name a country stays in the city, so an older free-text place is kept.
 */
export function parsePlace(value: string): ParsedPlace {
  const trimmed = value.trim()
  if (!trimmed) return { country: '', city: '' }
  const comma = trimmed.lastIndexOf(',')
  if (comma !== -1) {
    const code = countryCode(trimmed.slice(comma + 1))
    if (code) return { country: code, city: trimmed.slice(0, comma).trim() }
  }
  const whole = countryCode(trimmed)
  if (whole) return { country: whole, city: '' }
  return { country: '', city: trimmed }
}

/** The place as it is stored and shown: "Berlin, Germany", or whichever part was given. */
export function formatPlace(country: string, city: string, language: string): string {
  const cityText = city.trim()
  const name = country ? countryName(country, language) : ''
  if (cityText && name) return `${cityText}, ${name}`
  return cityText || name
}

export interface CountryOption {
  code: string
  name: string
  flag: string
}

/** Every country, named in `language` and ordered that way. */
export function countryOptions(language: string): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code, language),
    flag: flagEmoji(code),
  })).sort((a, b) => a.name.localeCompare(b.name, language) || a.code.localeCompare(b.code))
}
