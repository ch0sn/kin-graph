import ELK from 'elkjs/lib/elk.bundled.js'
import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { layoutFamily } from './familyLayout'
import { lineageEdgeIds } from './lineage'

const edge = (id: string, source: string, target: string) => ({ id, source, target })

describe('lineageEdgeIds', () => {
  // grandparents G1+G2 (union U1) → parent P; P+Q (union U2) → child C and sibling S
  const edges = [
    edge('G1->U1', 'G1', 'U1'),
    edge('G2->U1', 'G2', 'U1'),
    edge('U1->P', 'U1', 'P'),
    edge('P->U2', 'P', 'U2'),
    edge('Q->U2', 'Q', 'U2'),
    edge('U2->C', 'U2', 'C'),
    edge('U2->S', 'U2', 'S'),
  ]
  const unions = new Set(['U1', 'U2'])

  it('lights a line to a child, both parents, and every line above them', () => {
    expect([...lineageEdgeIds(edges, unions, 'U2->C')].sort()).toEqual(
      ['G1->U1', 'G2->U1', 'P->U2', 'Q->U2', 'U1->P', 'U2->C'].sort(),
    )
  })

  it('leaves a sibling’s own line alone', () => {
    expect(lineageEdgeIds(edges, unions, 'U2->C').has('U2->S')).toBe(false)
  })

  it('lights the same lines from a partner line, without the children', () => {
    expect([...lineageEdgeIds(edges, unions, 'P->U2')].sort()).toEqual(
      ['G1->U1', 'G2->U1', 'P->U2', 'Q->U2', 'U1->P'],
    )
  })

  it('stops at the top of the tree and ignores unknown lines', () => {
    expect([...lineageEdgeIds(edges, unions, 'U1->P')].sort()).toEqual(['G1->U1', 'G2->U1', 'U1->P'])
    expect(lineageEdgeIds(edges, unions, 'nope').size).toBe(0)
  })

  it('follows a lone parent straight up', () => {
    const lone = [edge('A->B', 'A', 'B'), edge('B->C', 'B', 'C')]
    expect([...lineageEdgeIds(lone, new Set(), 'B->C')].sort()).toEqual(['A->B', 'B->C'])
  })

  it('reaches every ancestor of the sample family’s manager, and no one else', async () => {
    const graph = sampleFamily()
    const { nodes, edges: all } = await layoutFamily(graph, new ELK(), { siblingOrder: 'oldest-first' })
    const unionIds = new Set(nodes.filter((n) => n.type === 'union').map((n) => n.id))
    const toAlex = all.find((e) => e.target === graph.managerId)!

    const lit = lineageEdgeIds(all, unionIds, toAlex.id)
    const givenOf = (id: string) => graph.people[id]?.names[0].given
    const peopleLit = new Set([...lit].flatMap((id) => {
      const e = all.find((x) => x.id === id)!
      return [givenOf(e.source), givenOf(e.target)].filter(Boolean)
    }))
    // Alex, his parents, both sets of grandparents known, and Grace's mother Ruth.
    expect([...peopleLit].sort()).toEqual(['Alex', 'George', 'Grace', 'John', 'Mary', 'Ruth'])
    expect(lit.size).toBe(7)
  })
})
