import { describe, expect, it } from 'vitest'
import { emptyValues, toPersonFields, validate, valuesFromPerson } from './personValues'

describe('validate', () => {
  it('requires a first name', () => {
    expect(validate(emptyValues({ givenName: '  ' }))).toEqual({
      givenName: expect.any(String),
    })
    expect(validate(emptyValues({ givenName: 'Ann' }))).toEqual({})
  })

  it('accepts full dates and years, and rejects malformed ones', () => {
    expect(validate(emptyValues({ givenName: 'Ann', birthDate: '1950-03-14' }))).toEqual({})
    expect(validate(emptyValues({ givenName: 'Ann', birthDate: '1950' }))).toEqual({})
    expect(validate(emptyValues({ givenName: 'Ann', birthDate: '195' }))).toHaveProperty(
      'birthDate',
    )
  })

  it('rejects a death before birth, comparing only known precision', () => {
    const values = (birthDate: string, deathDate: string) =>
      validate(emptyValues({ givenName: 'Ann', birthDate, deceased: true, deathDate }))
    expect(values('1950-03-14', '1949')).toHaveProperty('deathDate')
    expect(values('1950-03-14', '1950')).toEqual({})
    expect(values('1950', '1950-01-01')).toEqual({})
  })

  it('ignores the death date unless deceased is ticked', () => {
    expect(
      validate(emptyValues({ givenName: 'Ann', birthDate: '1950', deathDate: 'junk' })),
    ).toEqual({})
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
      deceased: undefined,
      deathDate: undefined,
      photoId: undefined,
    })
  })

  it('keeps a death date only for deceased people', () => {
    const base = emptyValues({ givenName: 'Ann', deathDate: '2015' })
    expect(toPersonFields({ ...base, deceased: true })).toMatchObject({
      deceased: true,
      deathDate: '2015',
    })
    expect(toPersonFields(base)).toMatchObject({ deceased: undefined, deathDate: undefined })
  })

  it('round-trips a person through the form', () => {
    const person = {
      id: '1',
      givenName: 'Grace',
      familyName: 'Ellis',
      gender: 'female' as const,
      birthDate: '1934-05-19',
      deathDate: '2015',
      photoId: 'photo-1',
    }
    expect(toPersonFields(valuesFromPerson(person))).toEqual({
      ...person,
      id: undefined,
      deceased: true,
    })
  })
})
