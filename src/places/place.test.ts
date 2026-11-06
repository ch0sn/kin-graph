import { describe, expect, it } from 'vitest'
import { suggestCities } from './cities'
import { flagEmoji, formatPlace, parsePlace } from './countries'

describe('places', () => {
  it('keeps a city and country together, in the language they were written', () => {
    expect(formatPlace('DE', 'Berlin', 'en')).toBe('Berlin, Germany')
    expect(formatPlace('DE', 'Berlin', 'de')).toBe('Berlin, Deutschland')
    expect(formatPlace('DE', '', 'en')).toBe('Germany')
    expect(formatPlace('', 'Cork', 'en')).toBe('Cork')
    expect(parsePlace('Berlin, Germany')).toEqual({ country: 'DE', city: 'Berlin' })
    expect(parsePlace('Berlin, Deutschland')).toEqual({ country: 'DE', city: 'Berlin' })
    expect(parsePlace('Berlin, DE')).toEqual({ country: 'DE', city: 'Berlin' })
    expect(parsePlace('Cork, Ireland')).toEqual({ country: 'IE', city: 'Cork' })
    expect(parsePlace('Germany')).toEqual({ country: 'DE', city: '' })
    expect(parsePlace('Busan')).toEqual({ country: '', city: 'Busan' })
    expect(parsePlace('Washington, D.C.')).toEqual({ country: '', city: 'Washington, D.C.' })
    expect(parsePlace('')).toEqual({ country: '', city: '' })
  })

  it('draws a flag from the country code', () => {
    expect(flagEmoji('DE')).toBe('🇩🇪')
    expect(flagEmoji('kr')).toBe('🇰🇷')
  })

  it('suggests a city from its spelling, an accent, or a similar sound', () => {
    expect(suggestCities('DE', 'M')).toEqual([])
    expect(suggestCities('DE', 'Mün')).toContain('München')
    expect(suggestCities('DE', 'Muenchen')).toContain('München')
    expect(suggestCities('DE', 'Munchen')).toContain('München')
    expect(suggestCities('DE', 'Munich')).toContain('München')
    expect(suggestCities('DE', 'Koeln')).toContain('Köln')
    expect(suggestCities('DE', 'Koln')).toContain('Köln')
    expect(suggestCities('DE', 'Cologne')).toContain('Köln')
    expect(suggestCities('DE', 'Nurnberg')).toContain('Nürnberg')
    expect(suggestCities('DE', 'Berln')).toContain('Berlin')
    expect(suggestCities('AT', 'Wien')[0]).toBe('Wien')
    expect(suggestCities('CZ', 'Prag')).toContain('Praha')
    expect(suggestCities('', 'Berlin')).toEqual([])
  })
})
