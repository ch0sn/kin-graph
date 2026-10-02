import { afterEach, describe, expect, it } from 'vitest'
import { setCurrentLanguage } from '../i18n'
import {
  ageOf,
  compareNames,
  formatAge,
  formatName,
  fullName,
  initials,
  isFuzzyDate,
  lifeYears,
  nameOrder,
} from './format'
import type { PersonName } from './types'

describe('isFuzzyDate', () => {
  it.each(['1950', '1950-03', '1950-03-14', '2001-12-31'])('accepts %s', (text) => {
    expect(isFuzzyDate(text)).toBe(true)
  })

  it.each(['', '50', '1950-13', '1950-3', '1950-03-32', '14/03/1950', '1950-03-14T00:00'])(
    'rejects %s',
    (text) => {
      expect(isFuzzyDate(text)).toBe(false)
    },
  )
})

describe('lifeYears', () => {
  it('shows whichever years are known', () => {
    expect(lifeYears({ id: '1', names: [{ given: 'A' }], birthDate: '1934-05-19', deathDate: '2015' }))
      .toBe('1934 – 2015')
    expect(lifeYears({ id: '1', names: [{ given: 'A' }], birthDate: '1988' })).toBe('b. 1988')
    expect(lifeYears({ id: '1', names: [{ given: 'A' }], deathDate: '1902-01' })).toBe('d. 1902')
    expect(lifeYears({ id: '1', names: [{ given: 'A' }] })).toBeNull()
  })

  it('marks people who died on an unknown date', () => {
    expect(lifeYears({ id: '1', names: [{ given: 'A' }], birthDate: '1934', deceased: true })).toBe(
      '1934 – ?',
    )
    expect(lifeYears({ id: '1', names: [{ given: 'A' }], deceased: true })).toBe('Deceased')
  })
})

describe('ageOf / formatAge', () => {
  const today = new Date(2026, 9, 1) // 1 October 2026
  const age = (birthDate: string, extra: object = {}) => {
    const result = ageOf({ id: '1', names: [{ given: 'A' }], birthDate, ...extra }, today)
    return result && formatAge(result)
  }

  it('counts whole years from a full birth date', () => {
    expect(age('1988-06-12')).toBe('38')
    expect(age('1988-10-01')).toBe('38') // birthday today
    expect(age('1988-10-02')).toBe('37') // birthday tomorrow
  })

  it('is approximate when only the year, or the birthday month, is known', () => {
    expect(age('1990')).toBe('~36')
    expect(age('1990-10')).toBe('~36') // sometime this month
    expect(age('1990-09')).toBe('36') // month already passed
    expect(age('1990-11')).toBe('35') // month still ahead
  })

  it('shows babies in months', () => {
    expect(age('2026-04-15')).toBe('5 mo')
    expect(age('2026-09-30')).toBe('0 mo')
    expect(age('2026')).toBe('<1')
  })

  it('gives the age reached by people who have died', () => {
    expect(age('1934-05-19', { deathDate: '2015-08-02' })).toBe('81')
    expect(age('1934-05-19', { deathDate: '2015-03-02' })).toBe('80')
    expect(age('1934-05-19', { deathDate: '2015' })).toBe('~81')
    expect(age('1910', { deathDate: '1989' })).toBe('~79')
    expect(age('2001-03-10', { deathDate: '2001-07-01' })).toBe('3 mo')
  })

  it('has no age without the dates to work it out', () => {
    expect(age('1934', { deceased: true })).toBeNull()
    expect(ageOf({ id: '1', names: [{ given: 'A' }] }, today)).toBeNull()
    expect(ageOf({ id: '1', names: [{ given: 'A' }], deathDate: '1990' }, today)).toBeNull()
    expect(age('2027-01-01')).toBeNull()
  })
})

const one = (name: PersonName) => ({ names: [name] as [PersonName] })

afterEach(() => setCurrentLanguage('en'))

describe('formatName', () => {
  it('writes given names first by default', () => {
    expect(formatName({ given: 'Mary Ann', surnames: ['Smith'] })).toBe('Mary Ann Smith')
    expect(formatName({ given: 'Cher' })).toBe('Cher')
  })

  it('writes every surname, in order', () => {
    expect(formatName({ given: 'Ana', surnames: ['García', 'López'] })).toBe('Ana García López')
  })

  it('puts a patronymic after the given name', () => {
    expect(formatName({ given: 'Björk', patronymic: 'Guðmundsdóttir' })).toBe('Björk Guðmundsdóttir')
    expect(formatName({ given: 'Ivan', patronymic: 'Ivanovich', surnames: ['Petrov'] })).toBe(
      'Ivan Ivanovich Petrov',
    )
  })

  it('writes family-first names surname first', () => {
    const name: PersonName = { given: 'Péter', surnames: ['Nagy'], order: 'family-first' }
    expect(formatName(name)).toBe('Nagy Péter')
    expect(
      formatName({ given: 'Ivan', patronymic: 'Ivanovich', surnames: ['Petrov'], order: 'family-first' }),
    ).toBe('Petrov Ivan Ivanovich')
  })

  it('writes CJK names family-first without spaces', () => {
    expect(formatName({ given: '민준', surnames: ['김'] })).toBe('김민준')
    expect(formatName({ given: '敏俊', surnames: ['金'] })).toBe('金敏俊')
    expect(formatName({ given: '花子', surnames: ['山田'] })).toBe('山田花子')
  })

  it('ignores blank parts', () => {
    expect(formatName({ given: 'Ann', surnames: [' ', 'Lee'], patronymic: '' })).toBe('Ann Lee')
  })
})

describe('nameOrder', () => {
  it('follows the name, then its script', () => {
    const minjun = { given: 'Minjun', surnames: ['Kim'] }
    expect(nameOrder(minjun)).toBe('given-first')
    expect(nameOrder({ ...minjun, order: 'family-first' })).toBe('family-first')
    expect(nameOrder({ given: '민준', surnames: ['김'] })).toBe('family-first')
    expect(nameOrder({ given: '민준', surnames: ['김'], order: 'given-first' })).toBe('given-first')
  })

  it('does not depend on the app language', () => {
    setCurrentLanguage('ko')
    expect(fullName(one({ given: 'Mary', surnames: ['Smith'] }))).toBe('Mary Smith')
    expect(fullName(one({ given: 'Minjun', surnames: ['Kim'], order: 'family-first' }))).toBe(
      'Kim Minjun',
    )
    expect(fullName(one({ given: '민준', surnames: ['김'] }))).toBe('김민준')
  })
})

describe('initials', () => {
  it('uses the first letter of each name', () => {
    expect(initials(one({ given: 'grace', surnames: ['Ellis'] }))).toBe('GE')
    expect(initials(one({ given: 'Cher' }))).toBe('C')
  })

  it('uses the first surname, or a patronymic when there is none', () => {
    expect(initials(one({ given: 'Ana', surnames: ['García', 'López'] }))).toBe('AG')
    expect(initials(one({ given: 'Björk', patronymic: 'Guðmundsdóttir' }))).toBe('BG')
  })

  it('follows the written order', () => {
    expect(initials(one({ given: 'Péter', surnames: ['Nagy'], order: 'family-first' }))).toBe('NP')
  })

  it('uses the given name for CJK names', () => {
    expect(initials(one({ given: '민준', surnames: ['김'] }))).toBe('민준')
    expect(initials(one({ given: '伟', surnames: ['王'] }))).toBe('伟')
  })

  it('only shows the shown name, and copes with letters outside the basic plane', () => {
    expect(initials({ names: [{ given: 'Robert' }, { type: 'nickname', given: 'Bob' }] })).toBe('R')
    expect(initials(one({ given: '𝒜da' }))).toBe('𝒜')
  })
})

describe('compareNames', () => {
  it('sorts by surname, then patronymic, then given name', () => {
    const people = [
      one({ given: 'Zoe', surnames: ['Adams'] }),
      one({ given: 'Ana', surnames: ['García', 'López'] }),
      one({ given: 'Ana', surnames: ['García', 'Abad'] }),
      one({ given: 'Björk', patronymic: 'Guðmundsdóttir' }),
      one({ given: 'Ann', surnames: ['adams'] }),
    ]
    expect(people.sort(compareNames).map(fullName)).toEqual([
      'Björk Guðmundsdóttir',
      'Ann adams',
      'Zoe Adams',
      'Ana García Abad',
      'Ana García López',
    ])
  })
})
