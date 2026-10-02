import { describe, expect, it } from 'vitest'
import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  createGraph,
  GraphError,
  linkParent,
  linkPartners,
  removePerson,
} from './graph'
import { childIdsOf, parentIdsOf, siblingsOf, stepParentIdsOf } from './queries'

const manager = () => createGraph({ names: [{ given: 'Alex' }], gender: 'male' })

describe('addSibling', () => {
  it("links the new sibling to all of the person's parents", () => {
    let graph = manager()
    const me = graph.managerId
    const mother = addParent(graph, me, { names: [{ given: 'Mary' }] })
    const father = addParent(mother.graph, me, { names: [{ given: 'John' }] })
    graph = father.graph

    const { graph: next, person: sister } = addSibling(graph, me, { names: [{ given: 'Sara' }] })

    expect(parentIdsOf(next, sister.id).sort()).toEqual(
      [mother.person.id, father.person.id].sort(),
    )
    expect(siblingsOf(next, me)).toEqual([{ id: sister.id, type: 'full' }])
  })

  it('links a half-sibling to only the shared parent', () => {
    const graph = manager()
    const me = graph.managerId
    const mother = addParent(graph, me, { names: [{ given: 'Mary' }] })
    const father = addParent(mother.graph, me, { names: [{ given: 'John' }] })

    const { graph: next, person: brother } = addSibling(
      father.graph,
      me,
      { names: [{ given: 'Tom' }] },
      { sharedParentIds: [father.person.id] },
    )
    const withStepmother = addParent(next, brother.id, { names: [{ given: 'Linda' }] })

    expect(siblingsOf(withStepmother.graph, me)).toEqual([{ id: brother.id, type: 'half' }])
  })

  it('creates a placeholder parent when none is recorded, then fills it in', () => {
    const graph = manager()
    const me = graph.managerId

    const { graph: withSister, person: sister } = addSibling(graph, me, { names: [{ given: 'Sara' }] })
    const [placeholderId] = parentIdsOf(withSister, me)
    expect(withSister.people[placeholderId].isPlaceholder).toBe(true)
    expect(siblingsOf(withSister, me)).toEqual([{ id: sister.id, type: 'full' }])

    const { graph: next, person: mother } = addParent(withSister, me, { names: [{ given: 'Mary' }] })
    expect(mother.id).toBe(placeholderId)
    expect(mother.isPlaceholder).toBe(false)
    expect(parentIdsOf(next, sister.id)).toEqual([mother.id])
  })

  it('rejects a shared parent who is not a parent of the person', () => {
    const graph = manager()
    const stranger = addPartner(graph, graph.managerId, { names: [{ given: 'Emma' }] })
    expect(() =>
      addSibling(stranger.graph, graph.managerId, { names: [{ given: 'Sara' }] }, {
        sharedParentIds: [stranger.person.id],
      }),
    ).toThrow(GraphError)
  })
})

describe('addParent', () => {
  it('also links the parent to full siblings with the same recorded parents', () => {
    const graph = manager()
    const me = graph.managerId
    const mother = addParent(graph, me, { names: [{ given: 'Mary' }] })
    const sister = addSibling(mother.graph, me, { names: [{ given: 'Sara' }] })

    const father = addParent(sister.graph, me, { names: [{ given: 'John' }] })

    expect(parentIdsOf(father.graph, sister.person.id)).toContain(father.person.id)
  })

  it('can be limited to the person alone', () => {
    const graph = manager()
    const me = graph.managerId
    const mother = addParent(graph, me, { names: [{ given: 'Mary' }] })
    const sister = addSibling(mother.graph, me, { names: [{ given: 'Sara' }] })

    const father = addParent(sister.graph, me, { names: [{ given: 'John' }] }, { siblingIds: [] })

    expect(parentIdsOf(father.graph, sister.person.id)).not.toContain(father.person.id)
  })
})

describe('addChild', () => {
  it("uses the parent's only ongoing partner as the other parent", () => {
    const graph = manager()
    const wife = addPartner(graph, graph.managerId, { names: [{ given: 'Emma' }] }, 'married')
    const { graph: next, person: child } = addChild(wife.graph, graph.managerId, {
      names: [{ given: 'Lily' }],
    })
    expect(parentIdsOf(next, child.id).sort()).toEqual(
      [graph.managerId, wife.person.id].sort(),
    )
  })

  it('ignores former partners and honours an explicit null co-parent', () => {
    const graph = manager()
    const ex = addPartner(graph, graph.managerId, { names: [{ given: 'Emma' }] }, 'divorced')
    const first = addChild(ex.graph, graph.managerId, { names: [{ given: 'Lily' }] })
    expect(parentIdsOf(first.graph, first.person.id)).toEqual([graph.managerId])

    const wife = addPartner(first.graph, graph.managerId, { names: [{ given: 'Kate' }] }, 'married')
    const second = addChild(wife.graph, graph.managerId, { names: [{ given: 'Max' }] }, {
      coParentId: null,
    })
    expect(parentIdsOf(second.graph, second.person.id)).toEqual([graph.managerId])
  })
})

describe('step-relations', () => {
  it("derives step-parents and step-siblings from a parent's partner", () => {
    const graph = manager()
    const me = graph.managerId
    const father = addParent(graph, me, { names: [{ given: 'John' }] })
    const stepmother = addPartner(father.graph, father.person.id, { names: [{ given: 'Linda' }] }, 'married')
    const stepsister = addChild(stepmother.graph, stepmother.person.id, { names: [{ given: 'Kim' }] }, {
      coParentId: null,
    })

    expect(stepParentIdsOf(stepsister.graph, me)).toEqual([stepmother.person.id])
    expect(siblingsOf(stepsister.graph, me)).toEqual([
      { id: stepsister.person.id, type: 'step' },
    ])
  })
})

describe('validation', () => {
  it('prevents someone becoming their own ancestor', () => {
    const graph = manager()
    const child = addChild(graph, graph.managerId, { names: [{ given: 'Lily' }] })
    expect(() => linkParent(child.graph, child.person.id, graph.managerId)).toThrow(
      'own ancestor',
    )
  })

  it('allows at most two biological parents', () => {
    let graph = manager()
    for (const givenName of ['Mary', 'John']) {
      graph = addParent(graph, graph.managerId, { names: [{ given: givenName }] }, { siblingIds: [] }).graph
    }
    expect(() => addParent(graph, graph.managerId, { names: [{ given: 'Third' }] })).toThrow(
      'two biological parents',
    )
    expect(() =>
      addParent(graph, graph.managerId, { names: [{ given: 'Adoptive' }] }, { kind: 'adoptive' }),
    ).not.toThrow()
  })

  it('rejects duplicate and self partnerships', () => {
    const graph = manager()
    const wife = addPartner(graph, graph.managerId, { names: [{ given: 'Emma' }] })
    expect(() => linkPartners(wife.graph, wife.person.id, graph.managerId)).toThrow(GraphError)
    expect(() => linkPartners(graph, graph.managerId, graph.managerId)).toThrow(GraphError)
  })

  it('never removes the manager', () => {
    const graph = manager()
    expect(() => removePerson(graph, graph.managerId)).toThrow(GraphError)
  })
})

describe('removePerson', () => {
  it('removes their links and any placeholder parent left with one child', () => {
    const graph = manager()
    const me = graph.managerId
    const sister = addSibling(graph, me, { names: [{ given: 'Sara' }] })
    const [placeholderId] = parentIdsOf(sister.graph, me)

    const next = removePerson(sister.graph, sister.person.id)

    expect(next.people[sister.person.id]).toBeUndefined()
    expect(next.people[placeholderId]).toBeUndefined()
    expect(next.parentLinks).toEqual([])
  })

  it('leaves the original graph untouched', () => {
    const graph = manager()
    const child = addChild(graph, graph.managerId, { names: [{ given: 'Lily' }] })
    removePerson(child.graph, child.person.id)
    expect(childIdsOf(child.graph, graph.managerId)).toEqual([child.person.id])
  })
})
