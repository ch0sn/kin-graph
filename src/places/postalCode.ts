/**
 * Turning a postal code into "City, Country" with OpenStreetMap's Nominatim
 * search. This is the one place the app goes online: only the postal code
 * and the reader's language are sent, never names or anything from the tree.
 */

export interface Place {
  /** What goes in the field: "Berlin, Germany". */
  label: string
  /** ISO 3166-1 alpha-2, lower case: "de". */
  countryCode?: string
  /** Shown when choosing between matches: "10115 · Berlin, Germany". */
  detail: string
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/** Short, has a digit, and only letters, digits, spaces and dashes: "10115", "SW1A 1AA", "06236". */
export function looksLikePostalCode(text: string): boolean {
  const trimmed = text.trim()
  return /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(trimmed) && /\d/.test(trimmed)
}

/**
 * Countries the browser's languages point to, most likely first. Each locale
 * counts twice: its own region ("de-DE" → Germany) and its language's home
 * country ("de-US" → Germany, "ko" → South Korea), since many people keep a
 * US or UK region whatever languages they read. Only used to order matches.
 */
export function preferredCountries(locales: readonly string[] = navigator.languages): string[] {
  const countries: string[] = []
  const add = (region: string | undefined) => {
    if (region && /^[A-Z]{2}$/.test(region) && !countries.includes(region.toLowerCase())) {
      countries.push(region.toLowerCase())
    }
  }
  for (const locale of locales) {
    try {
      const tag = new Intl.Locale(locale)
      add(tag.region)
      add(new Intl.Locale(tag.language).maximize().region)
    } catch {
      // Not a valid locale tag; try the next.
    }
  }
  return countries
}

/** Matches from preferred countries first, in that order; the service's order otherwise. */
export function rankPlaces(places: Place[], preferred: readonly string[]): Place[] {
  const rank = (place: Place) => {
    const i = place.countryCode ? preferred.indexOf(place.countryCode) : -1
    return i === -1 ? preferred.length : i
  }
  return places
    .map((place, index) => ({ place, index }))
    .sort((a, b) => rank(a.place) - rank(b.place) || a.index - b.index)
    .map(({ place }) => place)
}

interface NominatimResult {
  address?: Record<string, string | undefined>
}

const SETTLEMENT_KEYS = ['city', 'town', 'village', 'municipality', 'borough', 'suburb', 'county', 'state']

/** "Berlin, Germany" from one search result, or null when it names no place. */
export function placeFromResult(result: NominatimResult, code: string): Place | null {
  const address = result.address ?? {}
  const settlement = SETTLEMENT_KEYS.map((key) => address[key]).find(Boolean)
  const country = address.country
  const parts = [settlement, country].filter((p): p is string => !!p)
  if (parts.length === 0) return null
  const label = [...new Set(parts)].join(', ')
  const countryCode = address.country_code?.toLowerCase()
  return {
    label,
    ...(countryCode && { countryCode }),
    detail: `${address.postcode ?? code} · ${label}`,
  }
}

/** Places for a postal code in the service's order, duplicates removed. */
export function placesFromResults(results: NominatimResult[], code: string): Place[] {
  const places = new Map<string, Place>()
  for (const result of results) {
    const place = placeFromResult(result, code)
    if (place && !places.has(place.label)) places.set(place.label, place)
  }
  return [...places.values()]
}

/** Nominatim asks for no more than one request a second. */
const MIN_INTERVAL = 1100
let lastRequest = 0

async function waitTurn(signal?: AbortSignal) {
  const wait = lastRequest + MIN_INTERVAL - Date.now()
  if (wait > 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, wait)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
  }
  lastRequest = Date.now()
}

async function search(
  code: string,
  { language, countries, signal }: { language: string; countries?: string[]; signal?: AbortSignal },
): Promise<NominatimResult[]> {
  await waitTurn(signal)
  const params = new URLSearchParams({
    postalcode: code.trim(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    'accept-language': language,
  })
  if (countries?.length) params.set('countrycodes', countries.join(','))
  const response = await fetch(`${ENDPOINT}?${params}`, { signal })
  if (!response.ok) throw new Error(`Postal code lookup failed: ${response.status}`)
  return (await response.json()) as NominatimResult[]
}

/**
 * Looks a postal code up. Postal codes repeat across countries (10115 is
 * Berlin, Manhattan and Zagreb), so the countries the family already lives in
 * are searched first; only if none of them has the code is the whole world
 * searched, with the browser's languages' countries put first. Names come back in the
 * reader's language.
 */
export async function lookupPostalCode(
  code: string,
  {
    language,
    knownCountries = [],
    preferred = preferredCountries(),
    signal,
  }: { language: string; knownCountries?: string[]; preferred?: readonly string[]; signal?: AbortSignal },
): Promise<Place[]> {
  if (knownCountries.length > 0) {
    const known = placesFromResults(await search(code, { language, countries: knownCountries, signal }), code)
    if (known.length > 0) return rankPlaces(known, preferred)
  }
  return rankPlaces(placesFromResults(await search(code, { language, signal }), code), preferred)
}
