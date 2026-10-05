import { afterEach, describe, expect, it } from 'vitest'
import { setCurrentLanguage } from '../i18n'
import {
  buildDate,
  compareDates,
  compareOptionalDates,
  dateBounds,
  dateProblem,
  formatFuzzyDate,
  formatYear,
  isCertainlyBefore,
  isFuzzyDate,
  joinDate,
  parseDate,
  splitDate,
} from './dates'

afterEach(() => setCurrentLanguage('en'))

describe('parseDate / isFuzzyDate', () => {
  it.each([
    ['1950', 'exact', '1950', undefined],
    ['1950-03-14', 'exact', '1950-03-14', undefined],
    ['~1890', 'about', '1890', undefined],
    ['~1890-05', 'about', '1890-05', undefined],
    ['<1920', 'before', '1920', undefined],
    ['>1920-01-02', 'after', '1920-01-02', undefined],
    ['1910/1915', 'range', '1910', '1915'],
    ['1910-03/1910-06', 'range', '1910-03', '1910-06'],
    ['1910/1910', 'range', '1910', '1910'],
  ])('reads %s', (text, qualifier, start, end) => {
    expect(parseDate(text)).toEqual({ qualifier, start, ...(end && { end }) })
    expect(isFuzzyDate(text)).toBe(true)
  })

  it.each(['', '~', '~~1890', '<>1890', '1915/1910', '1910/', '/1910', '1910/1912/1914', '~1890/1900', 'c. 1890', '1890?', '~1950-13'])(
    'rejects %s',
    (text) => {
      expect(isFuzzyDate(text)).toBe(false)
    },
  )

  it('builds what it parses', () => {
    for (const text of ['1950', '~1890', '<1920', '>1920-05', '1910/1915-02']) {
      expect(buildDate(parseDate(text)!)).toBe(text)
    }
  })
})

describe('dateProblem', () => {
  it('tells a backwards range from nonsense', () => {
    expect(dateProblem('1950')).toBeNull()
    expect(dateProblem('1915/1910')).toBe('rangeOrder')
    expect(dateProblem('1910/')).toBe('invalid')
    expect(dateProblem('soon')).toBe('invalid')
  })
})

describe('splitDate / joinDate', () => {
  it('splits and rejoins what was typed, even when incomplete', () => {
    for (const text of ['1950', '~1890', '<19', '>1920', '1910/1915', '1910/']) {
      expect(joinDate(splitDate(text))).toBe(text)
    }
    expect(joinDate({ qualifier: 'about', start: '', end: '' })).toBe('')
    expect(joinDate({ qualifier: 'range', start: '', end: '' })).toBe('')
  })
})

describe('dateBounds', () => {
  it('covers the days a date could be', () => {
    expect(dateBounds('1950')).toEqual({ from: '1950-01-01', to: '1950-12-31' })
    expect(dateBounds('1950-02')).toEqual({ from: '1950-02-01', to: '1950-02-28' })
    expect(dateBounds('1952-02')).toEqual({ from: '1952-02-01', to: '1952-02-29' })
    expect(dateBounds('1950-03-14')).toEqual({ from: '1950-03-14', to: '1950-03-14' })
    expect(dateBounds('<1920')).toEqual({ to: '1919-12-31' })
    expect(dateBounds('>1920')).toEqual({ from: '1921-01-01' })
    expect(dateBounds('1910/1915-06')).toEqual({ from: '1910-01-01', to: '1915-06-30' })
    expect(dateBounds('~1950-03')).toEqual({ from: '1945-03-01', to: '1955-03-31' })
    expect(dateBounds('nope')).toBeNull()
  })

  it('knows when one date is certainly earlier than another', () => {
    expect(isCertainlyBefore('1900', '1901')).toBe(true)
    expect(isCertainlyBefore('1900-05', '1900-06-01')).toBe(true)
    expect(isCertainlyBefore('1900', '1900-06')).toBe(false)
    expect(isCertainlyBefore('1900/1905', '1903')).toBe(false)
    expect(isCertainlyBefore('1900/1905', '1906')).toBe(true)
    expect(isCertainlyBefore('<1900', '1900')).toBe(true)
    expect(isCertainlyBefore('1900', '>1900')).toBe(true)
    expect(isCertainlyBefore('>1900', '1950')).toBe(false)
    expect(isCertainlyBefore('1950', '<1900')).toBe(false)
    expect(isCertainlyBefore('1950', '1950')).toBe(false)
    expect(isCertainlyBefore('~1948', '1950')).toBe(false)
    expect(isCertainlyBefore('~1940', '1950')).toBe(true)
  })
})

describe('compareDates', () => {
  const sorted = (dates: string[]) => [...dates].sort(compareDates)

  it('orders plain dates chronologically whatever their precision', () => {
    expect(sorted(['1951', '1950-06', '1950-03-14', '1949'])).toEqual([
      '1949',
      '1950-03-14',
      '1950-06',
      '1951',
    ])
  })

  it('places before ahead of, and after behind, the date they name', () => {
    expect(sorted(['1920', '>1920', '<1920', '~1920'])).toEqual(['<1920', '~1920', '1920', '>1920'])
  })

  it('orders ranges by start, then end', () => {
    expect(sorted(['1912/1920', '1910/1925', '1910/1915', '1911'])).toEqual([
      '1910/1915',
      '1910/1925',
      '1911',
      '1912/1920',
    ])
  })

  it('gives the same order whatever order it starts in', () => {
    const dates = ['~1900', '1900', '<1900', '1900/1901', '>1899', '1900-01', '1899', '~1900-01']
    const expected = sorted(dates)
    for (let i = 0; i < dates.length; i++) {
      const rotated = [...dates.slice(i), ...dates.slice(0, i)]
      expect(sorted(rotated)).toEqual(expected)
      expect(sorted([...rotated].reverse())).toEqual(expected)
    }
  })

  it('puts missing dates last', () => {
    const list = ['1900', undefined, '1800']
    expect([...list].sort(compareOptionalDates)).toEqual(['1800', '1900', undefined])
  })
})

describe('formatFuzzyDate / formatYear', () => {
  it('writes dates out in English', () => {
    expect(formatFuzzyDate('1988-06-12')).toBe('June 12, 1988')
    expect(formatFuzzyDate('1988-06')).toBe('June 1988')
    expect(formatFuzzyDate('~1890')).toBe('about 1890')
    expect(formatFuzzyDate('<1920-03')).toBe('before March 1920')
    expect(formatFuzzyDate('>1920')).toBe('after 1920')
    expect(formatFuzzyDate('1910/1915')).toBe('between 1910 and 1915')
  })

  it.each([
    ['de', '~1890', 'um 1890'],
    ['de', '1910/1915', 'zwischen 1910 und 1915'],
    ['es', '<1920', 'antes de 1920'],
    ['es', '>1920', 'después de 1920'],
    ['ko', '~1890', '1890년경'],
    ['ko', '1910/1915', '1910년~1915년 사이'],
  ] as const)('writes %s %s', (language, date, text) => {
    setCurrentLanguage(language)
    expect(formatFuzzyDate(date)).toBe(text)
  })

  it('shortens to the year', () => {
    expect(formatYear('1988-06-12')).toBe('1988')
    expect(formatYear('~1890-05')).toBe('~1890')
    expect(formatYear('<1920')).toBe('<1920')
    expect(formatYear('>1920')).toBe('>1920')
    expect(formatYear('1910-02/1915-06')).toBe('1910–1915')
    expect(formatYear('1910-02/1910-06')).toBe('1910')
  })
})
