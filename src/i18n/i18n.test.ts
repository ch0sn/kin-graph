import { afterEach, describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { ko } from './ko'
import { setCurrentLanguage, translate } from './core'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  it.each([
    ['German', de],
    ['Spanish', es],
    ['Korean', ko],
  ])('give every English message a %s one, with the same placeholders', (name, dictionary) => {
    for (const [key, english] of Object.entries(en)) {
      const translated = (dictionary as Record<string, string>)[key]
      expect(translated, `${key} has no ${name} translation`).toBeTruthy()
      expect(placeholders(translated), `${key} placeholders differ`).toEqual(placeholders(english))
    }
  })

  it('always spell the app title "KinGraph"', () => {
    for (const text of [en, de, es, ko].flatMap(Object.values)) {
      for (const match of text.matchAll(/kingraph/gi)) expect(match[0]).toBe('KinGraph')
    }
  })
})

describe('translate', () => {
  it('fills in placeholders', () => {
    expect(translate('en', 'sheet.for', { name: 'Ann' })).toBe('for Ann')
    expect(translate('de', 'sheet.for', { name: 'Ann' })).toBe('für Ann')
  })

  it('picks plural forms', () => {
    expect(translate('en', 'people', { count: 1 })).toBe('1 person')
    expect(translate('en', 'people', { count: 12 })).toBe('12 people')
    expect(translate('de', 'people', { count: 1 })).toBe('1 Person')
    expect(translate('de', 'people', { count: 12 })).toBe('12 Personen')
    expect(translate('es', 'people', { count: 1 })).toBe('1 persona')
    expect(translate('es', 'people', { count: 12 })).toBe('12 personas')
    expect(translate('ko', 'people', { count: 1 })).toBe('1명')
    expect(translate('ko', 'people', { count: 12 })).toBe('12명')
  })

  it('leaves unknown placeholders alone', () => {
    expect(translate('en', 'sheet.for')).toBe('for {name}')
  })
})

afterEach(() => {
  // Reset the shared language other tests rely on.
  setCurrentLanguage('en')
})
