import { describe, expect, it } from 'vitest'
import { initials, isFuzzyDate, lifeYears } from './format'

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

describe('initials', () => {
  it('uses the first letter of each name', () => {
    expect(initials({ givenName: 'grace', familyName: 'Ellis' })).toBe('GE')
    expect(initials({ givenName: 'Cher' })).toBe('C')
  })
})
