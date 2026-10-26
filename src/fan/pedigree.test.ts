import { describe, expect, it } from 'vitest'
import { addParent, addSibling, createGraph, linkParent, type PersonResult } from '../model/graph'
import type { FamilyGraph, NewPerson, PersonId } from '../model/types'
import { ancestorCounts, generationOf, parentPair, pedigree } from './pedigree'

const p = (given: string, gender?: NewPerson['gender']): NewPerson => ({ names: [{ given }], gender })

function family() {
  let graph: FamilyGraph = createGraph(p('Alex', 'male'))
  const ids: Record<string, PersonId> = { alex: graph.managerId }
  const add = (name: string, result: PersonResult) => {
    graph = result.graph
    ids[name] = result.person.id
  }
  // The mother is recorded first, so the sides must come from gender, not order.
  add('mary', addParent(graph, ids.alex, p('Mary', 'female')))
  add('john', addParent(graph, ids.alex, p('John', 'male')))
  add('grace', addParent(graph, ids.mary, p('Grace', 'female')))
  add('walter', addParent(graph, ids.john, p('Walter', 'male')))
  return { graph: () => graph, ids, set: (g: FamilyGraph) => (graph = g) }
}

describe('pedigree', () => {
  it('numbers ancestors with the father’s side first', () => {
    const { graph, ids } = family()
    const { slots } = pedigree(graph(), ids.alex, 2)
    expect(slots).toHaveLength(8)
    expect(slots.slice(1)).toEqual([ids.alex, ids.john, ids.mary, ids.walter, null, null, ids.grace])
  })

  it('counts known ancestors, leaving out the centre person', () => {
    const { graph, ids } = family()
    expect(ancestorCounts(pedigree(graph(), ids.alex, 2))).toEqual({ known: 4, total: 6 })
    expect(ancestorCounts(pedigree(graph(), ids.alex, 3))).toEqual({ known: 4, total: 14 })
  })

  it('can be centred on anyone', () => {
    const { graph, ids } = family()
    expect(pedigree(graph(), ids.mary, 1).slots.slice(1)).toEqual([ids.mary, null, ids.grace])
  })

  it('marks an ancestor reached along two lines', () => {
    const { graph, ids, set } = family()
    // Walter is John's father and, here, Mary's too.
    set(linkParent(graph(), ids.walter, ids.mary, 'biological'))
    const result = pedigree(graph(), ids.alex, 2)
    expect(result.slots.filter((id) => id === ids.walter)).toHaveLength(2)
    expect([...result.repeated]).toEqual([ids.walter])
  })
})

describe('parentPair', () => {
  it('leaves out placeholder parents', () => {
    let graph: FamilyGraph = createGraph(p('Alex', 'male'))
    // A sibling added before any parents links the two through a placeholder.
    graph = addSibling(graph, graph.managerId, p('Sara', 'female')).graph
    expect(parentPair(graph, graph.managerId)).toEqual([null, null])
  })

  it('puts a lone mother on the mother’s side', () => {
    let graph: FamilyGraph = createGraph(p('Alex'))
    const mum = addParent(graph, graph.managerId, p('Ann', 'female'))
    graph = mum.graph
    expect(parentPair(graph, graph.managerId)).toEqual([null, mum.person.id])
  })

  it('keeps the recorded order when gender doesn’t decide', () => {
    let graph: FamilyGraph = createGraph(p('Alex'))
    const a = addParent(graph, graph.managerId, p('Kim', 'female'))
    const b = addParent(a.graph, graph.managerId, p('Jo', 'female'))
    expect(parentPair(b.graph, graph.managerId)).toEqual([a.person.id, b.person.id])
  })

  it('uses adoptive parents only when no birth parents are recorded', () => {
    let graph: FamilyGraph = createGraph(p('Alex'))
    const adoptive = addParent(graph, graph.managerId, p('Rose', 'female'), { kind: 'adoptive' })
    graph = adoptive.graph
    expect(parentPair(graph, graph.managerId)).toEqual([null, adoptive.person.id])
    const birth = addParent(graph, graph.managerId, p('Tom', 'male'))
    expect(parentPair(birth.graph, graph.managerId)).toEqual([birth.person.id, null])
  })
})

describe('generationOf', () => {
  it('reads the generation from the slot number', () => {
    expect([1, 2, 3, 4, 7, 8, 15, 16].map(generationOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
  })
})
