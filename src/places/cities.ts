import { CITY_DATA } from './cities.data'
import { spokenForms } from './speak'

interface IndexedCity {
  label: string
  /** Spoken forms of the label and its other names. */
  keys: string[]
}

let byCountry: Map<string, IndexedCity[]> | null = null

function citiesByCountry(): Map<string, IndexedCity[]> {
  if (byCountry) return byCountry
  const map = new Map<string, IndexedCity[]>()
  for (const line of CITY_DATA.split('\n')) {
    if (!line) continue
    const [country, label, extra] = line.split('\t')
    if (!country || !label) continue
    const city = { label, keys: spokenForms([label, ...(extra ? extra.split('|') : [])]) }
    const list = map.get(country)
    if (list) list.push(city)
    else map.set(country, [city])
  }
  byCountry = map
  return map
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 0; i < a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i + 1
    for (let j = 0; j < b.length; j++) {
      const next = a[i] === b[j] ? diagonal : Math.min(diagonal, prev[j], prev[j + 1]) + 1
      diagonal = prev[j + 1]
      prev[j + 1] = next
    }
  }
  return prev[b.length]
}

function score(keys: readonly string[], needles: readonly string[]): number | null {
  let best: number | null = null
  for (const needle of needles) {
    for (const key of keys) {
      let rank: number | null = null
      if (key === needle) rank = 0
      else if (key.startsWith(needle)) rank = 1
      else if (needle.length >= 4 && key.length >= 4) {
        const distance = levenshtein(key, needle)
        const limit = needle.length >= 8 ? 2 : 1
        if (distance <= limit) rank = 3 + distance
      }
      if (rank !== null && (best === null || rank < best)) best = rank
    }
  }
  return best
}

/**
 * Cities in `country` (an ISO code) that resemble `query`. Empty until two
 * characters have been typed. Larger cities come first when they match equally.
 */
export function suggestCities(country: string, query: string, limit = 6): string[] {
  const needles = spokenForms([query]).filter((form) => form.length >= 2)
  if (!country || needles.length === 0) return []
  const cities = citiesByCountry().get(country.toUpperCase())
  if (!cities) return []
  const ranked: { label: string; rank: number; index: number }[] = []
  for (let index = 0; index < cities.length; index++) {
    const city = cities[index]
    const rank = score(city.keys, needles)
    if (rank !== null) ranked.push({ label: city.label, rank, index })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index)
  const labels: string[] = []
  for (const row of ranked) {
    if (!labels.includes(row.label)) labels.push(row.label)
    if (labels.length === limit) break
  }
  return labels
}
