import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setCurrentLanguage } from '../i18n'
import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  createGraph,
  linkPartners,
  type PersonResult,
} from './graph'
import { relationshipLabel } from './kinship'
import type { FamilyGraph, NewPerson, PersonId } from './types'

/** Builds a sample extended family around Alex, recording each person's id by name. */
function buildFamily() {
  let graph: FamilyGraph = createGraph({ givenName: 'Alex', gender: 'male' })
  const ids: Record<string, PersonId> = { alex: graph.managerId }
  const add = (name: string, result: PersonResult) => {
    graph = result.graph
    ids[name] = result.person.id
  }
  const p = (givenName: string, gender: NewPerson['gender']): NewPerson => ({
    givenName,
    gender,
  })

  // Parents, siblings and step-family
  add('mary', addParent(graph, ids.alex, p('Mary', 'female')))
  add('john', addParent(graph, ids.alex, p('John', 'male')))
  graph = linkPartners(graph, ids.mary, ids.john, { status: 'divorced' })
  add('sara', addSibling(graph, ids.alex, p('Sara', 'female')))
  add('linda', addPartner(graph, ids.john, p('Linda', 'female'), 'married'))
  add('tom', addChild(graph, ids.john, p('Tom', 'male')))
  add('kim', addChild(graph, ids.linda, p('Kim', 'female'), { coParentId: null }))
  add('ivy', addChild(graph, ids.tom, p('Ivy', 'female')))
  add('paul', addPartner(graph, ids.sara, p('Paul', 'male'), 'married'))
  add('leo', addChild(graph, ids.sara, p('Leo', 'male')))

  // Mother's side
  add('grace', addParent(graph, ids.mary, p('Grace', 'female')))
  add('george', addParent(graph, ids.mary, p('George', 'male')))
  add('ruth', addParent(graph, ids.grace, p('Ruth', 'female')))
  add('ann', addSibling(graph, ids.mary, p('Ann', 'female')))
  add('ben', addChild(graph, ids.ann, p('Ben', 'male')))
  add('zoe', addChild(graph, ids.ben, p('Zoe', 'female')))
  add('rob', addPartner(graph, ids.ann, p('Rob', 'male'), 'married'))
  add('edith', addSibling(graph, ids.grace, p('Edith', 'female')))
  add('carl', addChild(graph, ids.edith, p('Carl', 'male')))
  add('dora', addChild(graph, ids.carl, p('Dora', 'female')))

  // Alex's own family and in-laws
  add('emma', addPartner(graph, ids.alex, p('Emma', 'female'), 'married'))
  add('lily', addChild(graph, ids.alex, p('Lily', 'female')))
  add('sam', addPartner(graph, ids.lily, p('Sam', 'male'), 'married'))
  add('max', addChild(graph, ids.lily, p('Max', 'male')))
  add('joan', addParent(graph, ids.emma, p('Joan', 'female')))
  add('dan', addSibling(graph, ids.emma, p('Dan', 'male')))
  add('nora', addSibling(graph, ids.joan, p('Nora', 'female')))
  add('pat', addChild(graph, ids.nora, p('Pat', 'other')))

  return { graph, ids }
}

describe('relationshipLabel', () => {
  const { graph, ids } = buildFamily()
  const label = (name: string, from = 'alex') => relationshipLabel(graph, ids[name], ids[from])

  it.each([
    ['alex', 'You'],
    ['mary', 'Mother'],
    ['john', 'Father'],
    ['sara', 'Sister'],
    ['tom', 'Half-brother'],
    ['ivy', 'Half-niece'],
    ['leo', 'Nephew'],
    ['grace', 'Grandmother'],
    ['ruth', 'Great-grandmother'],
    ['ann', 'Aunt'],
    ['ben', 'First cousin'],
    ['zoe', 'First cousin once removed'],
    ['edith', 'Great-aunt'],
    ['carl', 'First cousin once removed'],
    ['dora', 'Second cousin'],
    ['lily', 'Daughter'],
    ['max', 'Grandson'],
  ])('labels blood relative %s as %s', (name, expected) => {
    expect(label(name)).toBe(expected)
  })

  it.each([
    ['emma', 'Wife'],
    ['linda', 'Stepmother'],
    ['kim', 'Stepsister'],
    ['rob', 'Uncle'],
    ['paul', 'Brother-in-law'],
    ['sam', 'Son-in-law'],
    ['joan', 'Mother-in-law'],
    ['dan', 'Brother-in-law'],
    ['pat', "Wife's first cousin"],
  ])('labels %s as %s', (name, expected) => {
    expect(label(name)).toBe(expected)
  })

  it('labels relationships from other perspectives', () => {
    expect(label('mary', 'john')).toBe('Ex-wife')
    expect(label('alex', 'linda')).toBe('Stepson')
    expect(label('alex', 'ben')).toBe('First cousin')
    expect(label('alex', 'grace')).toBe('Grandson')
  })

  it('uses neutral words when gender is not male or female', () => {
    const { graph: g, person } = addChild(graph, ids.alex, { givenName: 'Robin' })
    expect(relationshipLabel(g, person.id)).toBe('Child')
  })

  it('returns null for unrelated people', () => {
    const { graph: g, person } = addChild(graph, ids.kim, { givenName: 'Stranger' }, {
      coParentId: null,
    })
    expect(relationshipLabel(g, person.id)).toBeNull()
  })
})

describe('relationshipLabel in German', () => {
  const { graph, ids } = buildFamily()
  const label = (name: string, from = 'alex') => relationshipLabel(graph, ids[name], ids[from])

  beforeAll(() => setCurrentLanguage('de'))
  afterAll(() => setCurrentLanguage('en'))

  it.each([
    ['alex', 'Du'],
    ['mary', 'Mutter'],
    ['john', 'Vater'],
    ['sara', 'Schwester'],
    ['tom', 'Halbbruder'],
    ['ivy', 'Halbnichte'],
    ['leo', 'Neffe'],
    ['grace', 'Großmutter'],
    ['ruth', 'Urgroßmutter'],
    ['ann', 'Tante'],
    ['edith', 'Großtante'],
    ['ben', 'Cousin'],
    ['zoe', 'Cousine (1 Generation versetzt)'],
    ['dora', 'Cousine 2. Grades'],
    ['lily', 'Tochter'],
    ['max', 'Enkel'],
    ['emma', 'Ehefrau'],
    ['linda', 'Stiefmutter'],
    ['kim', 'Stiefschwester'],
    ['rob', 'Onkel'],
    ['paul', 'Schwager'],
    ['sam', 'Schwiegersohn'],
    ['joan', 'Schwiegermutter'],
    ['dan', 'Schwager'],
  ])('labels %s as %s', (name, expected) => {
    expect(label(name)).toBe(expected)
  })

  it('handles divorced partners and stepchildren from other perspectives', () => {
    expect(label('mary', 'john')).toBe('Ex-Ehefrau')
    expect(label('alex', 'linda')).toBe('Stiefsohn')
    expect(label('alex', 'grace')).toBe('Enkel')
  })
})
