import { afterEach, describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { setCurrentLanguage, translate } from './core'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  it('give every English message a German one, with the same placeholders', () => {
    for (const [key, english] of Object.entries(en)) {
      const german = (de as Record<string, string>)[key]
      expect(german, `${key} has no German translation`).toBeTruthy()
      expect(placeholders(german), `${key} placeholders differ`).toEqual(placeholders(english))
    }
  })

  it('always spell the app title "KinGraph"', () => {
    for (const text of [...Object.values(en), ...Object.values(de)]) {
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
  })

  it('leaves unknown placeholders alone', () => {
    expect(translate('en', 'sheet.for')).toBe('for {name}')
  })
})

afterEach(() => {
  // Reset the shared language other tests rely on.
  setCurrentLanguage('en')
})
