import { describe, expect, it } from 'vitest'
import type { Person } from '../model'
import {
  emptyName,
  emptyValues,
  nameValues,
  toPersonFields,
  toPersonName,
  validate,
  valuesFromPerson,
  type PersonValues,
} from './personValues'

/** Form values for someone called `given`, with other fields as given. */
const named = (given: string, overrides: Partial<PersonValues> = {}) =>
  emptyValues({ names: [emptyName({ given })], ...overrides })

describe('validate', () => {
  it('requires a first name for the shown name only', () => {
    expect(validate(named('  '))).toEqual({ givenName: expect.any(String) })
    expect(validate(named('Ann'))).toEqual({})
    expect(validate(emptyValues({ names: [emptyName({ given: 'Ann' }), emptyName()] }))).toEqual({})
  })

  it('accepts uncertain dates and ranges', () => {
    for (const birthDate of ['~1890', '<1920-05', '>1920', '1910/1915']) {
      expect(validate(named('Ann', { birthDate }))).toEqual({})
    }
    expect(validate(named('Ann', { birthDate: '1915/1910' }))).toEqual({
      birthDate: 'The end can’t be before the start',
    })
    expect(validate(named('Ann', { birthDate: '~' }))).toHaveProperty('birthDate')
  })

  it('only objects to a death that is certainly before the birth', () => {
    const both = (birthDate: string, deathDate: string) =>
      validate(named('Ann', { birthDate, deceased: true, deathDate }))
    expect(both('1950', '1949')).toHaveProperty('deathDate')
    expect(both('1950', '<1950')).toHaveProperty('deathDate')
    expect(both('1950-06', '1950')).toEqual({})
    expect(both('~1950', '1950')).toEqual({})
    expect(both('1950', '~1949')).toEqual({})
    expect(both('1948/1952', '1950')).toEqual({})
    expect(both('>1950', '1951')).toEqual({})
    expect(both('>1950', '1950')).toHaveProperty('deathDate')
  })

  it('accepts full dates and years, and rejects malformed ones', () => {
    expect(validate(named('Ann', { birthDate: '1950-03-14' }))).toEqual({})
    expect(validate(named('Ann', { birthDate: '1950' }))).toEqual({})
    expect(validate(named('Ann', { birthDate: '195' }))).toHaveProperty('birthDate')
  })

  it('rejects a death before birth, comparing only known precision', () => {
    const values = (birthDate: string, deathDate: string) =>
      validate(named('Ann', { birthDate, deceased: true, deathDate }))
    expect(values('1950-03-14', '1949')).toHaveProperty('deathDate')
    expect(values('1950-03-14', '1950')).toEqual({})
    expect(values('1950', '1950-01-01')).toEqual({})
  })

  it('ignores the death date unless deceased is ticked', () => {
    expect(validate(named('Ann', { birthDate: '1950', deathDate: 'junk' }))).toEqual({})
  })
})

describe('toPersonFields', () => {
  it('trims text and turns blanks into undefined', () => {
    expect(
      toPersonFields(
        emptyValues({ names: [emptyName({ given: ' Ann ', surname: ' ' })], birthDate: '1963' }),
      ),
    ).toEqual({
      names: [{ given: 'Ann' }],
      gender: undefined,
      birthDate: '1963',
      deceased: undefined,
      deathDate: undefined,
      photoId: undefined,
    })
  })

  it('keeps a death date only for deceased people', () => {
    const base = named('Ann', { deathDate: '2015' })
    expect(toPersonFields({ ...base, deceased: true })).toMatchObject({
      deceased: true,
      deathDate: '2015',
    })
    expect(toPersonFields(base)).toMatchObject({ deceased: undefined, deathDate: undefined })
  })

  it('drops other names that were left empty', () => {
    const values = emptyValues({
      names: [emptyName({ given: 'Ann' }), emptyName({ type: 'birth' }), emptyName({ given: 'Annie' })],
    })
    expect(toPersonFields(values).names).toEqual([{ given: 'Ann' }, { given: 'Annie' }])
  })

  it('round-trips a person through the form', () => {
    const person: Person = {
      id: '1',
      names: [{ given: 'Grace', surnames: ['Ellis'] }],
      gender: 'female',
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

  it('keeps every name detail the form does not show', () => {
    const person: Person = {
      id: '1',
      names: [
        {
          given: '민준',
          surnames: ['김'],
          forms: [
            { script: 'hanja', given: '敏俊', surnames: ['金'] },
            { script: 'romanized', given: 'Minjun', surnames: ['Kim'] },
            { script: 'other', given: 'Минджун' },
          ],
        },
        { type: 'nickname', given: 'MJ' },
        { type: 'married', given: 'Ana', surnames: ['García', 'López'], from: '2010' },
        { type: 'birth', given: 'Björk', patronymic: 'Guðmundsdóttir' },
      ],
    }
    expect(toPersonFields(valuesFromPerson(person)).names).toEqual(person.names)
  })
})

describe('toPersonName', () => {
  it('returns null when nothing was entered, even with a kind chosen', () => {
    expect(toPersonName(emptyName({ type: 'nickname', surname: ' ' }))).toBeNull()
  })

  it('keeps a name that only has a surname, like a maiden name', () => {
    expect(toPersonName(emptyName({ type: 'birth', surname: 'Smith' }))).toEqual({
      type: 'birth',
      given: '',
      surnames: ['Smith'],
    })
  })

  it('keeps surnames apart until their text is changed', () => {
    const ana = nameValues({ given: 'Ana', surnames: ['García', 'López'] })
    expect(ana.surname).toBe('García López')
    expect(toPersonName(ana)?.surnames).toEqual(['García', 'López'])
    expect(toPersonName({ ...ana, surname: ' García López ' })?.surnames).toEqual(['García', 'López'])
    expect(toPersonName({ ...ana, surname: 'García Pérez' })?.surnames).toEqual(['García Pérez'])
    expect(toPersonName({ ...ana, surname: '' })?.surnames).toBeUndefined()
  })

  it('keeps a patronymic, which the form does not show', () => {
    const name = { given: 'Björk', patronymic: 'Guðmundsdóttir' }
    expect(toPersonName(nameValues(name))).toEqual(name)
  })
})
