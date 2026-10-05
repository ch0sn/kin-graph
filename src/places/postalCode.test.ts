import { describe, expect, it } from 'vitest'
import {
  looksLikePostalCode,
  placeFromResult,
  placesFromResults,
  preferredCountries,
  rankPlaces,
} from './postalCode'

describe('looksLikePostalCode', () => {
  it.each(['10115', '06236', 'SW1A 1AA', '1010', 'H3Z 2Y7', '28013'])('accepts %s', (text) => {
    expect(looksLikePostalCode(text)).toBe(true)
  })

  it.each(['', 'Berlin', 'New York', '1', 'Seoul, Korea', '12345678901', 'São Paulo'])('rejects %s', (text) => {
    expect(looksLikePostalCode(text)).toBe(false)
  })
})

describe('preferredCountries', () => {
  it('takes each locale’s region and its language’s home country, in order', () => {
    expect(preferredCountries(['de-DE'])).toEqual(['de'])
    expect(preferredCountries(['ko'])).toEqual(['kr'])
    expect(preferredCountries(['en-GB', 'en'])).toEqual(['gb', 'us'])
    // A browser set to US English that also reads German and Korean.
    expect(preferredCountries(['en-US', 'de-US', 'ko-US'])).toEqual(['us', 'de', 'kr'])
    expect(preferredCountries(['not a locale!', 'es-ES'])).toEqual(['es'])
    expect(preferredCountries([])).toEqual([])
  })
})

describe('placeFromResult', () => {
  it('names the town and country', () => {
    expect(
      placeFromResult({ address: { postcode: '10115', city: 'Berlin', country: 'Germany' } }, '10115'),
    ).toEqual({ label: 'Berlin, Germany', detail: '10115 · Berlin, Germany' })
    expect(
      placeFromResult({ address: { city: 'Berlin', country: 'Germany', country_code: 'DE' } }, '10115')
        ?.countryCode,
    ).toBe('de')
    expect(placeFromResult({ address: { village: 'Hallstatt', country: 'Austria' } }, '4830')).toEqual({
      label: 'Hallstatt, Austria',
      detail: '4830 · Hallstatt, Austria',
    })
  })

  it('copes with missing parts', () => {
    expect(placeFromResult({ address: { country: 'Monaco' } }, '98000')?.label).toBe('Monaco')
    expect(placeFromResult({ address: { city: 'Singapore', country: 'Singapore' } }, '1')?.label).toBe(
      'Singapore',
    )
    expect(placeFromResult({}, '1')).toBeNull()
  })

  it('drops duplicate places', () => {
    const results = [
      { address: { city: 'Berlin', country: 'Germany' } },
      { address: { city: 'Berlin', country: 'Germany' } },
      { address: { city: 'Zagreb', country: 'Croatia' } },
    ]
    expect(placesFromResults(results, '10115').map((p) => p.label)).toEqual(['Berlin, Germany', 'Zagreb, Croatia'])
  })
})

describe('rankPlaces', () => {
  it('puts preferred countries first, in their order, and keeps the rest in order', () => {
    const places = [
      { label: 'New York, United States', detail: '', countryCode: 'us' },
      { label: 'Zagreb, Croatia', detail: '', countryCode: 'hr' },
      { label: 'Gimpo-si, South Korea', detail: '', countryCode: 'kr' },
      { label: 'Berlin, Germany', detail: '', countryCode: 'de' },
    ]
    const order = (preferred: string[]) => rankPlaces(places, preferred).map((p) => p.countryCode)
    expect(order(['de'])).toEqual(['de', 'us', 'hr', 'kr'])
    expect(order(['us', 'de', 'kr'])).toEqual(['us', 'de', 'kr', 'hr'])
    expect(order([])).toEqual(['us', 'hr', 'kr', 'de'])
  })
})
