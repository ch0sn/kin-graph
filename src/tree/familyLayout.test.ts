import ELK from 'elkjs/lib/elk.bundled.js'
import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  childIdsOf,
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
  type FamilyEdge,
  type PersonNode,
} from './familyLayout'
import type { SiblingOrder } from './siblingOrder'

const elk = new ELK()

async function personPositions(graph: FamilyGraph, siblingOrder?: SiblingOrder) {
  const { nodes } = await layoutFamily(graph, elk, { siblingOrder })
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
    const tom = Object.values(graph.people).find((p) => p.names[0].given === 'Tom')!

    expect(graph.people[sara].names[0].given).toBe('Sara')
    expect(unionOf(tom.id)).not.toBe(unionOf(alex))
  })

  it('includes childless partnerships', () => {
    const graph = createGraph({ names: [{ given: 'Alex' }] })
    const { graph: next } = addPartner(graph, graph.managerId, { names: [{ given: 'Emma' }] })
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

  it.each<[SiblingOrder, string[]]>([
    ['oldest-first', ['Lily', 'Max', 'Ella']],
    ['youngest-first', ['Ella', 'Max', 'Lily']],
    ['boys-first', ['Max', 'Lily', 'Ella']],
    ['girls-first', ['Lily', 'Ella', 'Max']],
  ])('orders siblings %s, left to right', async (siblingOrder, expected) => {
    // In a fuller tree ELK's crossing minimisation is free to reorder siblings.
    let graph = sampleFamily()
    graph = addChild(graph, graph.managerId, {
      names: [{ given: 'Ella' }],
      gender: 'female',
      birthDate: '2023',
    }).graph
    const positions = await personPositions(graph, siblingOrder)
    const leftToRight = childIdsOf(graph, graph.managerId)
      .sort((a, b) => positions.get(a)!.x - positions.get(b)!.x)
      .map((id) => graph.people[id].names[0].given)
    expect(leftToRight).toEqual(expected)
  })

  it('orders your own siblings by you, even when your partner has parents in the tree', async () => {
    // Alex (male, 1988) and Sara (female, 1991). Alex's wife Emma (1989) has
    // her mother in the tree too, but it's Alex who belongs among his siblings.
    const graph = sampleFamily()
    const sara = Object.values(graph.people).find((p) => p.names[0].given === 'Sara')!
    const positions = await personPositions(graph, 'girls-first')
    expect(positions.get(sara.id)!.x).toBeLessThan(positions.get(graph.managerId)!.x)
  })

  it('places a married sibling by their own age, not their partner’s', async () => {
    const alex = createGraph({ names: [{ given: 'Alex' }], birthDate: '1990' })
    let graph = addParent(alex, alex.managerId, { names: [{ given: 'Mum' }], birthDate: '1960' }).graph
    const sister = addSibling(graph, alex.managerId, { names: [{ given: 'Bea' }], birthDate: '1985' })
    // Alex's much older partner must not pull Alex in front of an older sister.
    graph = addPartner(sister.graph, alex.managerId, { names: [{ given: 'Sol' }], birthDate: '1950' }).graph
    const positions = await personPositions(graph)
    expect(positions.get(sister.person.id)!.x).toBeLessThan(positions.get(alex.managerId)!.x)
  })

  describe('lines to children', () => {
    /** Each family line as the segments FamilyEdge draws. */
    async function familyLines(graph: FamilyGraph) {
      const { nodes, edges } = await layoutFamily(graph, elk)
      const byId = new Map(nodes.map((n) => [n.id, n]))
      return {
        nodes,
        lines: edges
          .filter((e): e is FamilyEdge => e.type === 'family')
          .map((edge) => {
            const source = byId.get(edge.source)!
            const target = byId.get(edge.target)!
            const from = {
              x: source.position.x + source.width! / 2,
              y: source.position.y + source.height!,
            }
            const to = { x: target.position.x + PERSON_WIDTH / 2, y: target.position.y }
            const busY = to.y - edge.data!.busOffset
            return { edge, from, to, busY }
          }),
      }
    }

    it('run their horizontal part in the gap between rows', async () => {
      const { lines } = await familyLines(sampleFamily())
      const gapBetweenRows = 64
      for (const { from, to, busY } of lines) {
        expect(busY).toBeGreaterThan(from.y)
        expect(busY).toBeGreaterThan(to.y - gapBetweenRows)
        expect(busY).toBeLessThan(to.y)
      }
    })

    it('never pass behind a card other than their own ends', async () => {
      const { nodes, lines } = await familyLines(sampleFamily())
      const cards = nodes.filter((n) => n.type === 'person')
      for (const { edge, from, to, busY } of lines) {
        const segments = [
          { x1: from.x, x2: from.x, y1: from.y, y2: busY },
          { x1: from.x, x2: to.x, y1: busY, y2: busY },
          { x1: to.x, x2: to.x, y1: busY, y2: to.y },
        ]
        for (const card of cards) {
          if (card.id === edge.target || edge.source.includes(card.id)) continue
          const left = card.position.x
          const top = card.position.y
          for (const s of segments) {
            const crossesX = Math.min(s.x1, s.x2) < left + PERSON_WIDTH && Math.max(s.x1, s.x2) > left
            const crossesY = Math.min(s.y1, s.y2) < top + PERSON_HEIGHT && Math.max(s.y1, s.y2) > top
            expect(crossesX && crossesY, `${edge.id} passes behind ${card.id}`).toBe(false)
          }
        }
      }
    })

    it('give overlapping families in the same gap separate levels', async () => {
      const { lines } = await familyLines(sampleFamily())
      const families = new Map<string, { busY: number; childTop: number; left: number; right: number }>()
      for (const { edge, from, to, busY } of lines) {
        const f = families.get(edge.source) ?? { busY, childTop: to.y, left: from.x, right: from.x }
        f.left = Math.min(f.left, to.x)
        f.right = Math.max(f.right, to.x)
        families.set(edge.source, f)
      }
      const all = [...families.values()]
      for (const [i, a] of all.entries()) {
        for (const b of all.slice(i + 1)) {
          const overlap = a.childTop === b.childTop && a.left < b.right && b.left < a.right
          if (overlap) expect(a.busY).not.toBe(b.busY)
        }
      }
    })
  })

  it('hides placeholder parents but keeps their children together', async () => {
    const graph = createGraph({ names: [{ given: 'Alex' }] })
    const { graph: next } = addSibling(graph, graph.managerId, { names: [{ given: 'Sara' }] })
    const { nodes, edges } = await layoutFamily(next, elk)

    expect(nodes.filter((n) => n.type === 'person')).toHaveLength(2)
    const union = nodes.find((n) => n.type === 'union')!
    expect(edges.filter((e) => e.source === union.id)).toHaveLength(2)
  })

  it('hangs a single parent’s children straight from them', async () => {
    const graph = createGraph({ names: [{ given: 'Alex' }] })
    const { graph: next, person } = addChild(graph, graph.managerId, { names: [{ given: 'Lily' }] })
    const { nodes, edges } = await layoutFamily(next, elk)

    expect(nodes.some((n) => n.type === 'union')).toBe(false)
    expect(edges).toEqual([
      expect.objectContaining({ source: graph.managerId, target: person.id }),
    ])
  })
})
