import ELK from 'elkjs/lib/elk.bundled.js'
import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  addChild,
  addPartner,
  addSibling,
  createGraph,
  parentIdsOf,
  partnerIdsOf,
  type FamilyGraph,
} from '../model'
import {
  deriveUnions,
  layoutFamily,
  PARTNER_GAP,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type PersonNode,
} from './familyLayout'

const elk = new ELK()

async function personPositions(graph: FamilyGraph) {
  const { nodes } = await layoutFamily(graph, elk)
  return new Map(
    nodes.filter((n): n is PersonNode => n.type === 'person').map((n) => [n.id, n.position]),
  )
}

describe('deriveUnions', () => {
  it('groups full siblings under one union and half-siblings under another', () => {
    const graph = sampleFamily()
    const alex = graph.managerId
    const unions = deriveUnions(graph)
    const unionOf = (id: string) => unions.find((u) => u.childIds.includes(id))!
    const [sara] = unionOf(alex).childIds.filter((id) => id !== alex)
    const tom = Object.values(graph.people).find((p) => p.givenName === 'Tom')!

    expect(graph.people[sara].givenName).toBe('Sara')
    expect(unionOf(tom.id)).not.toBe(unionOf(alex))
  })

  it('includes childless partnerships', () => {
    const graph = createGraph({ givenName: 'Alex' })
    const { graph: next } = addPartner(graph, graph.managerId, { givenName: 'Emma' })
    expect(deriveUnions(next)).toEqual([
      expect.objectContaining({ childIds: [], partnership: next.partnerships[0] }),
    ])
  })
})

describe('layoutFamily', () => {
  it('places every person on their own spot, with no overlaps', async () => {
    const positions = [...(await personPositions(sampleFamily())).values()]
    for (const [i, a] of positions.entries()) {
      for (const b of positions.slice(i + 1)) {
        const overlaps =
          Math.abs(a.x - b.x) < PERSON_WIDTH && Math.abs(a.y - b.y) < PERSON_HEIGHT
        expect(overlaps).toBe(false)
      }
    }
  })

  it('places parents above their children', async () => {
    const graph = sampleFamily()
    const positions = await personPositions(graph)
    for (const link of graph.parentLinks) {
      expect(positions.get(link.parentId)!.y).toBeLessThan(positions.get(link.childId)!.y)
    }
  })

  it('places partners side by side', async () => {
    const graph = sampleFamily()
    const positions = await personPositions(graph)
    for (const { partnerIds: [a, b] } of graph.partnerships) {
      const [pa, pb] = [positions.get(a)!, positions.get(b)!]
      expect(pa.y).toBe(pb.y)
      // Adjacent, or one apart when a third partner sits between them.
      const slots = Math.abs(pa.x - pb.x) / (PERSON_WIDTH + PARTNER_GAP)
      expect([1, 2]).toContain(Math.round(slots))
    }
  })

  it("seats each partner on the side of their own parents", async () => {
    const graph = sampleFamily()
    const positions = await personPositions(graph)
    const alex = graph.managerId
    const [emma] = partnerIdsOf(graph, alex)
    const [joan] = parentIdsOf(graph, emma)
    const [mary] = parentIdsOf(graph, alex)

    const emmaIsLeft = positions.get(emma)!.x < positions.get(alex)!.x
    const emmasSideIsLeft = positions.get(joan)!.x < positions.get(mary)!.x
    expect(emmaIsLeft).toBe(emmasSideIsLeft)
  })

  it('hides placeholder parents but keeps their children together', async () => {
    const graph = createGraph({ givenName: 'Alex' })
    const { graph: next } = addSibling(graph, graph.managerId, { givenName: 'Sara' })
    const { nodes, edges } = await layoutFamily(next, elk)

    expect(nodes.filter((n) => n.type === 'person')).toHaveLength(2)
    const union = nodes.find((n) => n.type === 'union')!
    expect(edges.filter((e) => e.source === union.id)).toHaveLength(2)
  })

  it('hangs a single parent’s children straight from them', async () => {
    const graph = createGraph({ givenName: 'Alex' })
    const { graph: next, person } = addChild(graph, graph.managerId, { givenName: 'Lily' })
    const { nodes, edges } = await layoutFamily(next, elk)

    expect(nodes.some((n) => n.type === 'union')).toBe(false)
    expect(edges).toEqual([
      expect.objectContaining({ source: graph.managerId, target: person.id }),
    ])
  })
})
