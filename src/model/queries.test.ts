import { describe, expect, it } from 'vitest'
import { addPartner, createGraph } from './graph'
import { surnamesForChild } from './queries'
import type { Gender, PartnershipStatus, PersonName } from './types'

function family(
  status: PartnershipStatus,
  mother: { names?: [PersonName, ...PersonName[]]; gender?: Gender } = {},
  father: { names?: [PersonName, ...PersonName[]]; gender?: Gender } = {},
) {
  const graph = createGraph({
    names: mother.names ?? [{ given: 'Anna', surnames: ['Berg'] }],
    gender: mother.gender === undefined ? 'female' : mother.gender,
  })
  const added = addPartner(
    graph,
    graph.managerId,
    {
      names: father.names ?? [{ given: 'Lars', surnames: ['Holm'] }],
      gender: father.gender === undefined ? 'male' : father.gender,
    },
    status,
  )
  return { graph: added.graph, motherId: graph.managerId, fatherId: added.person.id }
}

describe('surnamesForChild', () => {
  it('takes the father’s surnames when the child is added from the mother', () => {
    const { graph, motherId, fatherId } = family('married')
    expect(surnamesForChild(graph, motherId, fatherId)).toEqual(['Holm'])
  })

  it('takes the father’s surnames when the child is added from the father', () => {
    const { graph, motherId, fatherId } = family('married')
    expect(surnamesForChild(graph, fatherId, motherId)).toEqual(['Holm'])
  })

  it('keeps each of the father’s surnames', () => {
    const { graph, motherId, fatherId } = family('married', {}, {
      names: [{ given: 'Luis', surnames: ['García', 'López'] }],
    })
    expect(surnamesForChild(graph, motherId, fatherId)).toEqual(['García', 'López'])
  })

  it('uses the father’s shown surname, not the mother’s married name', () => {
    const { graph, motherId, fatherId } = family(
      'married',
      {
        names: [
          { given: 'Anna', surnames: ['Berg'] },
          { type: 'married', given: 'Anna', surnames: ['Holm'] },
        ],
      },
    )
    expect(surnamesForChild(graph, motherId, fatherId)).toEqual(['Holm'])
  })

  it.each(['partnered', 'separated', 'divorced', 'widowed'] as const)(
    'uses the parent the child is added from when the couple is %s',
    (status) => {
      const { graph, motherId, fatherId } = family(status)
      expect(surnamesForChild(graph, motherId, fatherId)).toEqual(['Berg'])
      expect(surnamesForChild(graph, fatherId, motherId)).toEqual(['Holm'])
    },
  )

  it('uses the parent the child is added from when the other parent is not recorded', () => {
    const { graph, motherId, fatherId } = family('married')
    expect(surnamesForChild(graph, motherId, null)).toEqual(['Berg'])
    expect(surnamesForChild(graph, fatherId, null)).toEqual(['Holm'])
  })

  it('uses the parent the child is added from when there is no single father', () => {
    const women = family('married', {}, { names: [{ given: 'Eva', surnames: ['Lind'] }], gender: 'female' })
    expect(surnamesForChild(women.graph, women.motherId, women.fatherId)).toEqual(['Berg'])
    expect(surnamesForChild(women.graph, women.fatherId, women.motherId)).toEqual(['Lind'])

    const men = family(
      'married',
      { names: [{ given: 'Erik', surnames: ['Berg'] }], gender: 'male' },
      { names: [{ given: 'Lars', surnames: ['Holm'] }], gender: 'male' },
    )
    expect(surnamesForChild(men.graph, men.motherId, men.fatherId)).toEqual(['Berg'])
    expect(surnamesForChild(men.graph, men.fatherId, men.motherId)).toEqual(['Holm'])
  })

  it('uses the mother’s surnames when the father has none', () => {
    const { graph, motherId, fatherId } = family('married', {}, { names: [{ given: 'Lars' }] })
    expect(surnamesForChild(graph, motherId, fatherId)).toEqual(['Berg'])
  })

  it('uses the man’s surnames when his partner’s gender is not recorded', () => {
    const graph = createGraph({ names: [{ given: 'Anna', surnames: ['Berg'] }] })
    const added = addPartner(
      graph,
      graph.managerId,
      { names: [{ given: 'Lars', surnames: ['Holm'] }], gender: 'male' },
      'married',
    )
    expect(surnamesForChild(added.graph, graph.managerId, added.person.id)).toEqual(['Holm'])
    expect(surnamesForChild(added.graph, added.person.id, graph.managerId)).toEqual(['Holm'])
  })
})
