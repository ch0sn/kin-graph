import { describe, expect, it } from 'vitest'
import { ageOf, formatAge, initials, isFuzzyDate, lifeYears } from './format'

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
    expect(lifeYears({ id: '1', givenName: 'A', birthDate: '1934-05-19', deathDate: '2015' }))
      .toBe('1934 – 2015')
    expect(lifeYears({ id: '1', givenName: 'A', birthDate: '1988' })).toBe('b. 1988')
    expect(lifeYears({ id: '1', givenName: 'A', deathDate: '1902-01' })).toBe('d. 1902')
    expect(lifeYears({ id: '1', givenName: 'A' })).toBeNull()
  })

  it('marks people who died on an unknown date', () => {
    expect(lifeYears({ id: '1', givenName: 'A', birthDate: '1934', deceased: true })).toBe(
      '1934 – ?',
    )
    expect(lifeYears({ id: '1', givenName: 'A', deceased: true })).toBe('Deceased')
  })
})

describe('ageOf / formatAge', () => {
  const today = new Date(2026, 9, 1) // 1 October 2026
  const age = (birthDate: string, extra: object = {}) => {
    const result = ageOf({ id: '1', givenName: 'A', birthDate, ...extra }, today)
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
    expect(ageOf({ id: '1', givenName: 'A' }, today)).toBeNull()
    expect(ageOf({ id: '1', givenName: 'A', deathDate: '1990' }, today)).toBeNull()
    expect(age('2027-01-01')).toBeNull()
  })
})

describe('initials', () => {
  it('uses the first letter of each name', () => {
    expect(initials({ givenName: 'grace', familyName: 'Ellis' })).toBe('GE')
    expect(initials({ givenName: 'Cher' })).toBe('C')
  })
})
