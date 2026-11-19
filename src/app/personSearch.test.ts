import { describe, expect, it } from 'vitest'
import type { Person } from '../model/types'
import { indexPeople, matchPeople } from './personSearch'

const maria: Person = {
  id: 'maria',
  names: [
    { given: 'María', surnames: ['García'] },
    {
      given: 'María',
      surnames: ['García', 'Rivera'],
      type: 'married',
      forms: [{ script: 'other', given: 'マリア', surnames: ['リベラ'] }],
    },
  ],
  birthDate: '1985',
}
const minjun: Person = {
  id: 'minjun',
  names: [{
    given: '민준',
    surnames: ['김'],
    forms: [
      { script: 'hanja', given: '敏俊', surnames: ['金'] },
      { script: 'romanized', given: 'Minjun', surnames: ['Kim'] },
    ],
  }],
}
const people = indexPeople({
  maria,
  minjun,
  'other-maria': { ...maria, id: 'other-maria', names: [maria.names[0]], birthDate: '1992' },
  partial: { id: 'partial', names: [{ given: 'Ana', surnames: ['Garciaparra'] }] },
  placeholder: { id: 'placeholder', names: [{ given: 'María', surnames: ['García'] }], isPlaceholder: true },
}, 'en')

describe('person search', () => {
  it('matches given names and partial surnames regardless of case or accents', () => {
    expect(matchPeople(people, '  mArIa ').map(({ person }) => person.id))
      .toEqual(['maria', 'other-maria'])
    expect(matchPeople(people, 'gÁRc').map(({ person }) => person.id))
      .toEqual(['partial', 'maria', 'other-maria'])
  })

  it('ranks exact names and name parts above substrings', () => {
    expect(matchPeople(people, 'GARCIA').map(({ person }) => person.id))
      .toEqual(['maria', 'other-maria', 'partial'])
    const names = indexPeople({
      longer: { id: 'longer', names: [{ given: 'Adele', surnames: ['Ada'] }] },
      exact: { id: 'exact', names: [{ given: 'Ada' }] },
    }, 'en')
    expect(matchPeople(names, 'Ada').map(({ person }) => person.id))
      .toEqual(['exact', 'longer'])
  })

  it('returns each profile once and identifies the matching married name', () => {
    expect(matchPeople(people, 'garcia rivera')).toEqual([
      { person: maria, name: 'María García', matchedName: 'María García Rivera' },
    ])
    const results = matchPeople(people, 'maria   garcia')
    expect(results.map(({ person }) => person.birthDate)).toEqual(['1985', '1992'])
    expect(results[0].matchedName).toBe('María García Rivera')
  })

  it.each([
    ['김민준', undefined],
    ['김 민준', undefined],
    ['金敏俊', '金敏俊'],
    ['KIM MINJUN', 'Minjun Kim'],
    ['minj', 'Minjun Kim'],
  ])('finds the same profile for %s', (query, matchedName) => {
    expect(matchPeople(people, query)).toMatchObject([{ person: minjun, name: '김민준', matchedName }])
  })

  it('indexes recorded spellings attached to alternate names', () => {
    expect(matchPeople(people, 'リベラ')).toMatchObject([{ person: maria, matchedName: 'リベラマリア' }])
  })

  it('searches only the provided tree and restores the initial results for a cleared query', () => {
    const otherTree = indexPeople({ outsider: { id: 'outsider', names: [{ given: 'Outsider' }] } }, 'en')
    expect(matchPeople(otherTree, 'outsider')).toHaveLength(1)
    expect(matchPeople(people, 'outsider')).toEqual([])
    expect(matchPeople(people, '  ')).toEqual(matchPeople(people, ''))
    expect(matchPeople(people, '').map(({ person }) => person.id))
      .toEqual(['partial', 'maria', 'other-maria', 'minjun'])
  })
})
