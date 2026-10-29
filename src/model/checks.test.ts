import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { checkTree, flaggedPeople } from './checks'
import { addChild, addPartner, addPerson, addSibling, createGraph, linkPartners } from './graph'
import type { FamilyGraph, NewPerson, Partnership, PersonId } from './types'

const today = new Date(2026, 9, 27)
const kinds = (graph: FamilyGraph) => checkTree(graph, { today }).map((issue) => issue.kind)
const person = (given: string, extra: Partial<NewPerson> = {}): NewPerson => ({ names: [{ given }], ...extra })

/** A parent and a child, with the given details. */
function parentAndChild(parent: Partial<NewPerson>, child: Partial<NewPerson>) {
  const graph = createGraph(person('Parent', parent))
  const added = addChild(graph, graph.managerId, person('Child', child), { coParentId: null })
  return { graph: added.graph, parentId: graph.managerId, childId: added.person.id }
}

/** Two partners, with the partnership's details and the first partner's. */
function couple(details: Partial<Omit<Partnership, 'id' | 'partnerIds'>>, first: Partial<NewPerson> = {}) {
  const graph = createGraph(person('Ann', first))
  const added = addPerson(graph, person('Ben'))
  return linkPartners(added.graph, graph.managerId, added.person.id, details)
}

describe('checkTree', () => {
  it('finds nothing wrong with the sample family', () => {
    expect(kinds(sampleFamily())).toEqual([])
  })

  describe('life spans', () => {
    it('flags a death before the birth', () => {
      const graph = createGraph(person('Ann', { birthDate: '1950', deathDate: '1949-12-31' }))
      expect(kinds(graph)).toEqual(['deathBeforeBirth'])
    })

    it('allows a death in the year of a birth known only by year', () => {
      expect(kinds(createGraph(person('Ann', { birthDate: '1950', deathDate: '1950-01-02' })))).toEqual([])
      expect(kinds(createGraph(person('Ann', { birthDate: '1950-06', deathDate: '1950' })))).toEqual([])
    })

    it('allows overlapping "about" and "between" dates', () => {
      expect(kinds(createGraph(person('Ann', { birthDate: '~1950', deathDate: '1948' })))).toEqual([])
      expect(kinds(createGraph(person('Ann', { birthDate: '1940/1950', deathDate: '<1945' })))).toEqual([])
    })

    it('flags someone who lived more than 120 years', () => {
      const graph = createGraph(person('Ann', { birthDate: '1800', deathDate: '1925' }))
      expect(kinds(graph)).toEqual(['tooOld'])
      expect(kinds(createGraph(person('Ann', { birthDate: '1800', deathDate: '1920' })))).toEqual([])
    })

    it('flags someone born over 120 years ago who is not known to have died', () => {
      expect(kinds(createGraph(person('Ann', { birthDate: '1890' })))).toEqual(['tooOldToBeLiving'])
      expect(kinds(createGraph(person('Ann', { birthDate: '1890', deceased: true })))).toEqual([])
      expect(kinds(createGraph(person('Ann', { birthDate: '1906-10-28' })))).toEqual([])
      expect(kinds(createGraph(person('Ann', { birthDate: '>1890' })))).toEqual([])
    })
  })

  describe('parents and children', () => {
    it('flags a parent born after their child', () => {
      const { graph, parentId, childId } = parentAndChild({ birthDate: '1960' }, { birthDate: '1950' })
      expect(checkTree(graph, { today })).toEqual([
        expect.objectContaining({ kind: 'parentBornAfterChild', severity: 'error', personIds: [childId, parentId] }),
      ])
    })

    it('flags a parent who was very young or very old at the birth', () => {
      expect(kinds(parentAndChild({ birthDate: '1950' }, { birthDate: '1955' }).graph)).toEqual(['parentTooYoung'])
      const died = { deceased: true }
      expect(kinds(parentAndChild({ birthDate: '1900', gender: 'female', ...died }, { birthDate: '1965' }).graph)).toEqual([
        'parentTooOld',
      ])
      expect(kinds(parentAndChild({ birthDate: '1900', gender: 'male', ...died }, { birthDate: '1965' }).graph)).toEqual([])
      expect(kinds(parentAndChild({ birthDate: '1900', gender: 'male', ...died }, { birthDate: '1985' }).graph)).toEqual([
        'parentTooOld',
      ])
    })

    it('does not flag ages that partial dates leave possible', () => {
      // Born 1950, child 1962: the parent could have been 12 by then.
      expect(kinds(parentAndChild({ birthDate: '1950' }, { birthDate: '1962' }).graph)).toEqual([])
      expect(kinds(parentAndChild({ birthDate: '1950' }, { birthDate: '~1958' }).graph)).toEqual([])
      expect(kinds(parentAndChild({ birthDate: '1950' }, { birthDate: '1950' }).graph)).toEqual(['parentTooYoung'])
    })

    it('flags a child born after their mother died', () => {
      const { graph } = parentAndChild({ gender: 'female', deathDate: '1950-03' }, { birthDate: '1950-04' })
      expect(kinds(graph)).toEqual(['bornAfterMotherDied'])
      const sameMonth = parentAndChild({ gender: 'female', deathDate: '1950-03' }, { birthDate: '1950-03-20' })
      expect(kinds(sameMonth.graph)).toEqual([])
    })

    it('allows a child born up to ten months after their father died', () => {
      const posthumous = parentAndChild({ gender: 'male', deathDate: '1950-03-01' }, { birthDate: '1950-11' })
      expect(kinds(posthumous.graph)).toEqual([])
      const late = parentAndChild({ gender: 'male', deathDate: '1950-03-01' }, { birthDate: '1951-02' })
      expect(kinds(late.graph)).toEqual(['bornAfterFatherDied'])
      expect(kinds(parentAndChild({ deathDate: '1950' }, { birthDate: '1951' }).graph)).toEqual([])
    })

    it('only checks ages for birth parents', () => {
      const graph = createGraph(person('Parent', { birthDate: '1990' }))
      const added = addChild(graph, graph.managerId, person('Child', { birthDate: '1980' }), {
        coParentId: null,
        kind: 'adoptive',
      })
      expect(kinds(added.graph)).toEqual([])
    })

    it('flags links that make someone their own parent or ancestor', () => {
      const { graph, parentId, childId } = parentAndChild({}, {})
      const looped: FamilyGraph = {
        ...graph,
        parentLinks: [
          ...graph.parentLinks,
          { parentId: childId, childId: parentId, kind: 'biological' },
          { parentId: childId, childId, kind: 'biological' },
        ],
      }
      const issues = checkTree(looped, { today })
      expect(issues.map((issue) => issue.kind).sort()).toEqual(['ancestryCycle', 'ownParent'])
      expect(issues.find((issue) => issue.kind === 'ancestryCycle')?.personIds.sort()).toEqual(
        [parentId, childId].sort(),
      )
    })
  })

  describe('partnerships', () => {
    it('flags a partnership that ends before it starts', () => {
      expect(kinds(couple({ startDate: '1980', endDate: '1979' }))).toEqual(['partnershipEndsBeforeStart'])
      expect(kinds(couple({ startDate: '1980', endDate: '1980-01' }))).toEqual([])
    })

    it('flags a partnership outside a partner’s life', () => {
      expect(kinds(couple({ startDate: '1970' }, { birthDate: '1975' }))).toEqual(['partnershipBeforeBirth'])
      expect(kinds(couple({ startDate: '1970' }, { deathDate: '1960' }))).toEqual(['partnershipAfterDeath'])
      expect(kinds(couple({ startDate: '1960', endDate: '1972' }, { deathDate: '1970' }))).toEqual([
        'partnershipAfterDeath',
      ])
      expect(kinds(couple({ startDate: '1970', endDate: '1970' }, { deathDate: '1970-05' }))).toEqual([])
    })

    it('flags two marriages that certainly ran at the same time', () => {
      let graph = createGraph(person('Ann'))
      const ann = graph.managerId
      graph = addPartner(graph, ann, person('Ben'), 'married').graph
      graph = addPartner(graph, ann, person('Carl'), 'married').graph
      const [first, second] = graph.partnerships
      const dated = (a: Partial<Partnership>, b: Partial<Partnership>): FamilyGraph => ({
        ...graph,
        partnerships: [
          { ...first, ...a },
          { ...second, ...b },
        ],
      })
      expect(kinds(dated({ startDate: '1970' }, { startDate: '1980' }))).toEqual(['overlappingPartnerships'])
      expect(kinds(dated({ startDate: '1970', endDate: '1975', status: 'divorced' }, { startDate: '1980' }))).toEqual(
        [],
      )
      // An undated divorce might have come before the second marriage.
      expect(kinds(dated({ startDate: '1970', status: 'divorced' }, { startDate: '1980' }))).toEqual([])
      expect(kinds(dated({}, { startDate: '1980' }))).toEqual([])
    })

    it('counts a partner’s death as the end of a marriage', () => {
      let graph = createGraph(person('Ann'))
      const ann = graph.managerId
      const ben = addPartner(graph, ann, person('Ben', { deathDate: '1978' }), 'married')
      graph = addPartner(ben.graph, ann, person('Carl'), 'married').graph
      const [first, second] = graph.partnerships
      graph = { ...graph, partnerships: [{ ...first, startDate: '1970' }, { ...second, startDate: '1980' }] }
      expect(kinds(graph)).toEqual([])
      const deceased = (id: PersonId): FamilyGraph => ({
        ...graph,
        people: { ...graph.people, [id]: { ...graph.people[id], deathDate: undefined, deceased: true } },
      })
      expect(kinds(deceased(ben.person.id))).toEqual([])
    })
  })

  describe('people', () => {
    it('flags people with the same name and birth date', () => {
      const graph = createGraph(person('Ann', { birthDate: '1950-01-02' }))
      const twin = addPerson(graph, { names: [{ given: ' ann ' }], birthDate: '1950-01-02' })
      expect(kinds(twin.graph)).toEqual(['possibleDuplicate'])
      expect(kinds(addPerson(graph, person('Ann', { birthDate: '1950' })).graph)).toEqual([])
      expect(kinds(addPerson(createGraph(person('Ann')), person('Ann')).graph)).toEqual([])
    })

    it('flags a placeholder parent that links fewer than two children', () => {
      const graph = createGraph(person('Ann'))
      const withSibling = addSibling(graph, graph.managerId, person('Ben'))
      expect(kinds(withSibling.graph)).toEqual([])
      const ben = withSibling.person.id
      const orphaned: FamilyGraph = {
        ...withSibling.graph,
        parentLinks: withSibling.graph.parentLinks.filter((l) => l.childId !== ben),
      }
      expect(kinds(orphaned)).toEqual(['orphanedPlaceholder'])
    })
  })

  it('keeps an issue’s id while it lasts, and lists errors first', () => {
    const { graph } = parentAndChild({ birthDate: '1960' }, { birthDate: '1950', deathDate: '1940' })
    const first = checkTree(graph, { today })
    const again = checkTree({ ...graph }, { today })
    expect(again.map((issue) => issue.id)).toEqual(first.map((issue) => issue.id))
    expect(first.map((issue) => issue.severity)).toEqual(['error', 'error'])
    expect(flaggedPeople(first).size).toBe(2)
  })
})
