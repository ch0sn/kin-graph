import { describe, expect, it } from 'vitest'
import { addChild, addParent, addPartner, addPerson, addSibling, createGraph, type PersonResult } from '../model/graph'
import type { FamilyGraph, NewPerson, PersonId } from '../model/types'
import { generationsFrom, timelineRows } from './rows'

const p = (given: string, birthDate?: string, deathDate?: string): NewPerson => ({
  names: [{ given }],
  birthDate,
  deathDate,
})

function family() {
  let graph: FamilyGraph = createGraph(p('Alex', '1988'))
  const ids: Record<string, PersonId> = { alex: graph.managerId }
  const add = (name: string, result: PersonResult) => {
    graph = result.graph
    ids[name] = result.person.id
  }
  add('mary', addParent(graph, ids.alex, p('Mary', '1960')))
  add('john', addParent(graph, ids.alex, p('John', '1958')))
  add('ann', addSibling(graph, ids.mary, p('Ann', '1963')))
  add('grace', addParent(graph, ids.mary, p('Grace', '1934', '2015')))
  add('emma', addPartner(graph, ids.alex, p('Emma', '1989'), 'married'))
  add('lily', addChild(graph, ids.alex, p('Lily', '2016')))
  add('rob', addPartner(graph, ids.ann, p('Rob'), 'married'))
  add('stranger', addPerson(graph, p('Stranger', '1970')))
  return { graph, ids }
}

describe('generationsFrom', () => {
  it('counts up through parents, down through children and across partners', () => {
    const { graph, ids } = family()
    const generations = generationsFrom(graph, ids.alex)
    expect(generations.get(ids.grace)).toBe(-2)
    expect(generations.get(ids.ann)).toBe(-1)
    expect(generations.get(ids.rob)).toBe(-1)
    expect(generations.get(ids.emma)).toBe(0)
    expect(generations.get(ids.lily)).toBe(1)
    expect(generations.has(ids.stranger)).toBe(false)
  })

  it('is relative to whoever is in the centre', () => {
    const { graph, ids } = family()
    expect(generationsFrom(graph, ids.mary).get(ids.lily)).toBe(2)
  })
})

describe('timelineRows', () => {
  it('groups by generation, oldest first, with unconnected people last', () => {
    const { graph, ids } = family()
    const { groups } = timelineRows(graph, ids.alex)
    expect(groups.map((g) => g.generation)).toEqual([-2, -1, 0, 1, null])
    expect(groups[1].personIds).toEqual([ids.john, ids.mary, ids.ann])
    expect(groups[4].personIds).toEqual([ids.stranger])
  })

  it('puts people without any dates in the undated list', () => {
    const { graph, ids } = family()
    const { groups, undated } = timelineRows(graph, ids.alex)
    expect(undated).toEqual([ids.rob])
    expect(groups.flatMap((g) => g.personIds)).not.toContain(ids.rob)
  })

  it('leaves out placeholder parents', () => {
    let graph: FamilyGraph = createGraph(p('Alex', '1988'))
    graph = addSibling(graph, graph.managerId, p('Sara', '1991')).graph
    const { groups, undated } = timelineRows(graph, graph.managerId)
    expect(groups).toHaveLength(1)
    expect(undated).toEqual([])
  })
})
