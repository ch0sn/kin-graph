import { describe, expect, it } from 'vitest'
import { emptyValues, toPersonFields, validate } from './personValues'

describe('validate', () => {
  it('requires a first name', () => {
    expect(validate(emptyValues({ givenName: '  ' }))).toEqual({
      givenName: expect.any(String),
    })
    expect(validate(emptyValues({ givenName: 'Ann' }))).toEqual({})
  })

  it('accepts partial dates and rejects malformed ones', () => {
    expect(validate(emptyValues({ givenName: 'Ann', birthDate: '1950-03' }))).toEqual({})
    expect(validate(emptyValues({ givenName: 'Ann', birthDate: '03/1950' }))).toHaveProperty(
      'birthDate',
    )
  })

  it('rejects a death before birth, comparing only known precision', () => {
    const values = (birthDate: string, deathDate: string) =>
      validate(emptyValues({ givenName: 'Ann', birthDate, deathDate }))
    expect(values('1950-03-14', '1949')).toHaveProperty('deathDate')
    expect(values('1950-03-14', '1950')).toEqual({})
    expect(values('1950', '1950-01-01')).toEqual({})
  })
})

describe('toPersonFields', () => {
  it('trims text and turns blanks into undefined', () => {
    expect(
      toPersonFields(emptyValues({ givenName: ' Ann ', familyName: ' ', birthDate: '1963' })),
    ).toEqual({
      givenName: 'Ann',
      familyName: undefined,
      gender: undefined,
      birthDate: '1963',
      deathDate: undefined,
    })
  })
})
