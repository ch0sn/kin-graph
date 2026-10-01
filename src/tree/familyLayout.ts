import type { Edge, Node } from '@xyflow/react'
import type { ELK, ElkExtendedEdge, ElkNode, ElkPort, LayoutOptions } from 'elkjs/lib/elk-api'
import {
  childIdsOf,
  isOngoing,
  parentIdsOf,
  partnerIdsOf,
  relationshipLabel,
  type FamilyGraph,
  type Partnership,
  type Person,
  type PersonId,
} from '../model'

export const PERSON_WIDTH = 184
export const PERSON_HEIGHT = 76
export const UNION_SIZE = 10
/** Horizontal space between partners, where the union dot sits. */
export const PARTNER_GAP = 48
/** Seconds each step away from the manager delays an element's entrance. */
export const ENTRANCE_STAGGER = 0.06

/**
 * A couple (or single parent) and the children they share. Every child hangs
 * off the union of exactly their recorded parents, so full siblings share a
 * union and half-siblings hang off different ones.
 */
export interface Union {
  id: string
  parentIds: PersonId[]
  childIds: PersonId[]
  partnership?: Partnership
}

/**
 * People who are laid out side by side: partners, and co-parents who never
 * partnered. ELK places each block as a single node so couples stay together.
 */
interface Block {
  id: string
  memberIds: PersonId[]
}

export interface PersonNodeData extends Record<string, unknown> {
  person: Person
  label: string | null
  isManager: boolean
  /** Steps from the manager through parent, child and partner links. */
  distance: number
}

export interface UnionNodeData extends Record<string, unknown> {
  distance: number
}

export type PersonNode = Node<PersonNodeData, 'person'>
export type UnionNode = Node<UnionNodeData, 'union'>
export type TreeNode = PersonNode | UnionNode

export interface FamilyLayout {
  nodes: TreeNode[]
  edges: Edge[]
}

const LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '32',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

const MAX_FLIP_PASSES = 3

export function deriveUnions(graph: FamilyGraph): Union[] {
  const unions = new Map<string, Union>()
  const unionOf = (parentIds: readonly PersonId[]) => {
    const sorted = [...parentIds].sort()
    const key = sorted.join('+')
    let union = unions.get(key)
    if (!union) {
      union = { id: `union:${key}`, parentIds: sorted, childIds: [] }
      unions.set(key, union)
    }
    return union
  }

  for (const partnership of graph.partnerships) {
    unionOf(partnership.partnerIds).partnership = partnership
  }
  for (const child of byBirth(Object.values(graph.people))) {
    const parentIds = parentIdsOf(graph, child.id)
    if (parentIds.length > 0) unionOf(parentIds).childIds.push(child.id)
  }
  return [...unions.values()]
}

/**
 * Lays the family out top-down by generation with ELK's layered algorithm.
 * Partners sit side by side with their union between them, and children
 * hang from the union. Placeholder parents aren't drawn; their children
 * still hang together from a free-standing union.
 */
export async function layoutFamily(graph: FamilyGraph, elk: ELK): Promise<FamilyLayout> {
  const isVisible = (id: PersonId) => !graph.people[id]?.isPlaceholder
  const unions = deriveUnions(graph)
  let blocks = partnerBlocks(graph, unions, isVisible)

  let positions = await runElk(elk, blocks, unions, isVisible)
  // ELK can't reorder people inside a block, so flip any couple whose members
  // sit on the wrong side of their own parents and lay out again.
  for (let pass = 0; pass < MAX_FLIP_PASSES; pass++) {
    const flipped = flipBlocksTowardParents(blocks, unions, positions, isVisible)
    if (flipped === blocks) break
    blocks = flipped
    positions = await runElk(elk, blocks, unions, isVisible)
  }

  return toReactFlow(graph, blocks, unions, positions, isVisible)
}

// --- Blocks -----------------------------------------------------------------

function partnerBlocks(
  graph: FamilyGraph,
  unions: Union[],
  isVisible: (id: PersonId) => boolean,
): Block[] {
  const people = byBirth(Object.values(graph.people).filter((p) => isVisible(p.id)))
  const neighbours = new Map<PersonId, Set<PersonId>>(people.map((p) => [p.id, new Set()]))
  for (const union of unions) {
    const parents = union.parentIds.filter(isVisible)
    for (const a of parents) {
      for (const b of parents) if (a !== b) neighbours.get(a)?.add(b)
    }
  }

  const placed = new Set<PersonId>()
  const blocks: Block[] = []
  for (const person of people) {
    if (placed.has(person.id)) continue
    const component = collect(person.id, neighbours)
    // Walk the component as a chain, starting from an end (someone with one
    // partner), so each partner sits next to the person they're linked to.
    const start = component.find((id) => neighbours.get(id)?.size === 1) ?? person.id
    const memberIds = chain(start, neighbours)
    for (const id of component) if (!memberIds.includes(id)) memberIds.push(id)
    memberIds.forEach((id) => placed.add(id))
    blocks.push({ id: `block:${memberIds.join('+')}`, memberIds })
  }
  return blocks
}

function collect(start: PersonId, neighbours: Map<PersonId, Set<PersonId>>): PersonId[] {
  const seen = new Set([start])
  const stack = [start]
  while (stack.length > 0) {
    for (const next of neighbours.get(stack.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return [...seen]
}

function chain(start: PersonId, neighbours: Map<PersonId, Set<PersonId>>): PersonId[] {
  const order = [start]
  let current = start
  for (;;) {
    const next = [...(neighbours.get(current) ?? [])].find((id) => !order.includes(id))
    if (!next) return order
    order.push(next)
    current = next
  }
}

const slotX = (index: number) => index * (PERSON_WIDTH + PARTNER_GAP) + PERSON_WIDTH / 2

function blockWidth(block: Block): number {
  const n = block.memberIds.length
  return n * PERSON_WIDTH + (n - 1) * PARTNER_GAP
}

/** Where a union's children hang from, relative to its parents' block. */
function unionAnchorX(block: Block, parentIds: PersonId[]): number {
  const xs = parentIds.map((id) => slotX(block.memberIds.indexOf(id)))
  return xs.reduce((sum, x) => sum + x, 0) / xs.length
}

// --- ELK --------------------------------------------------------------------

type Positions = Map<string, { x: number; y: number }>

async function runElk(
  elk: ELK,
  blocks: Block[],
  unions: Union[],
  isVisible: (id: PersonId) => boolean,
): Promise<Positions> {
  const blockOf = blockIndex(blocks)
  const inPort = (personId: PersonId) => `${blockOf.get(personId)!.id}:in:${personId}`
  const outPort = (union: Union) => `${union.id}:out`

  const ports = new Map<string, ElkPort[]>(blocks.map((b) => [b.id, []]))
  for (const block of blocks) {
    for (const [i, id] of block.memberIds.entries()) {
      ports.get(block.id)!.push(port(inPort(id), slotX(i), 0, 'NORTH'))
    }
  }

  const freeUnions: ElkNode[] = []
  const edges: ElkExtendedEdge[] = []
  for (const union of unions) {
    if (union.childIds.length === 0) continue
    const parents = union.parentIds.filter(isVisible)
    let source: string
    if (parents.length > 0) {
      const block = blockOf.get(parents[0])!
      source = outPort(union)
      ports.get(block.id)!.push(port(source, unionAnchorX(block, parents), PERSON_HEIGHT, 'SOUTH'))
    } else {
      source = union.id
      freeUnions.push({ id: union.id, width: UNION_SIZE, height: UNION_SIZE })
    }
    for (const childId of union.childIds) {
      if (!isVisible(childId)) continue
      edges.push({ id: `${union.id}->${childId}`, sources: [source], targets: [inPort(childId)] })
    }
  }

  const laidOut = await elk.layout({
    id: 'family',
    layoutOptions: LAYOUT_OPTIONS,
    children: [
      ...blocks.map((block) => ({
        id: block.id,
        width: blockWidth(block),
        height: PERSON_HEIGHT,
        ports: ports.get(block.id),
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
      })),
      ...freeUnions,
    ],
    edges,
  })

  return new Map(
    (laidOut.children ?? []).map((n: ElkNode) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
  )
}

function port(id: string, x: number, y: number, side: 'NORTH' | 'SOUTH'): ElkPort {
  return { id, x, y, width: 0, height: 0, layoutOptions: { 'elk.port.side': side } }
}

function blockIndex(blocks: Block[]): Map<PersonId, Block> {
  return new Map(blocks.flatMap((b) => b.memberIds.map((id) => [id, b] as const)))
}

/**
 * Reverses a block when its members are ordered against the direction of
 * their own parents: whoever's parents are further left should sit further
 * left. Returns the same array if nothing changed.
 */
function flipBlocksTowardParents(
  blocks: Block[],
  unions: Union[],
  positions: Positions,
  isVisible: (id: PersonId) => boolean,
): Block[] {
  const blockOf = blockIndex(blocks)
  const parentAnchorX = new Map<PersonId, number>()
  for (const union of unions) {
    const parents = union.parentIds.filter(isVisible)
    const x =
      parents.length > 0
        ? positions.get(blockOf.get(parents[0])!.id)!.x +
          unionAnchorX(blockOf.get(parents[0])!, parents)
        : (positions.get(union.id)?.x ?? 0) + UNION_SIZE / 2
    for (const childId of union.childIds) parentAnchorX.set(childId, x)
  }

  let changed = false
  const next = blocks.map((block) => {
    const n = block.memberIds.length
    if (n < 2) return block
    const center = positions.get(block.id)!.x + blockWidth(block) / 2
    // Positive when slot order agrees with parent direction, negative when not.
    const agreement = block.memberIds.reduce((sum, id, i) => {
      const anchor = parentAnchorX.get(id)
      return anchor === undefined ? sum : sum + (i - (n - 1) / 2) * (anchor - center)
    }, 0)
    if (agreement >= 0) return block
    changed = true
    return { ...block, memberIds: [...block.memberIds].reverse() }
  })
  return changed ? next : blocks
}

// --- React Flow ---------------------------------------------------------------

function toReactFlow(
  graph: FamilyGraph,
  blocks: Block[],
  unions: Union[],
  positions: Positions,
  isVisible: (id: PersonId) => boolean,
): FamilyLayout {
  const blockOf = blockIndex(blocks)
  const distances = distancesFrom(graph, graph.managerId)
  const nodes: TreeNode[] = []
  const edges: Edge[] = []

  for (const block of blocks) {
    const origin = positions.get(block.id)!
    for (const [i, id] of block.memberIds.entries()) {
      const person = graph.people[id]
      nodes.push({
        id,
        type: 'person',
        position: { x: origin.x + slotX(i) - PERSON_WIDTH / 2, y: origin.y },
        width: PERSON_WIDTH,
        height: PERSON_HEIGHT,
        data: {
          person,
          label: relationshipLabel(graph, id),
          isManager: id === graph.managerId,
          distance: distances.get(id) ?? 0,
        },
      })
    }
  }

  for (const union of unions) {
    const parents = union.parentIds.filter(isVisible)
    const distance = Math.min(...union.parentIds.map((id) => distances.get(id) ?? 0)) + 1
    const ended = union.partnership !== undefined && !isOngoing(union.partnership)

    let childSource: { source: string; sourceHandle: string }
    if (parents.length === 1) {
      // A single parent's children hang straight from them.
      childSource = { source: parents[0], sourceHandle: 'bottom' }
    } else {
      const block = parents.length > 0 ? blockOf.get(parents[0])! : undefined
      const position = block
        ? {
            x: positions.get(block.id)!.x + unionAnchorX(block, parents) - UNION_SIZE / 2,
            y: positions.get(block.id)!.y + PERSON_HEIGHT / 2 - UNION_SIZE / 2,
          }
        : positions.get(union.id)!
      nodes.push({
        id: union.id,
        type: 'union',
        position,
        width: UNION_SIZE,
        height: UNION_SIZE,
        selectable: false,
        data: { distance },
      })
      childSource = { source: union.id, sourceHandle: 'bottom' }

      for (const parentId of parents) {
        const order = block!.memberIds
        const leftOfUnion =
          order.indexOf(parentId) < order.indexOf(otherParent(parents, parentId))
        edges.push({
          id: `${parentId}->${union.id}`,
          type: 'straight',
          source: parentId,
          sourceHandle: leftOfUnion ? 'right' : 'left',
          target: union.id,
          targetHandle: leftOfUnion ? 'left' : 'right',
          className: ended ? 'edge-ended' : undefined,
        })
      }
    }

    for (const childId of union.childIds) {
      if (!isVisible(childId)) continue
      const nonBiological = graph.parentLinks.some(
        (l) =>
          l.childId === childId &&
          union.parentIds.includes(l.parentId) &&
          l.kind !== 'biological',
      )
      edges.push({
        id: `${union.id}->${childId}`,
        ...childSource,
        target: childId,
        targetHandle: 'top',
        className: nonBiological ? 'edge-nonbiological' : undefined,
      })
    }
  }

  // Edges fade in once both of their ends have appeared.
  const delayOf = new Map(nodes.map((n) => [n.id, n.data.distance * ENTRANCE_STAGGER]))
  for (const edge of edges) {
    const delay = Math.max(delayOf.get(edge.source) ?? 0, delayOf.get(edge.target) ?? 0)
    edge.style = { animationDelay: `${delay}s` }
  }

  return { nodes, edges }
}

function otherParent(parents: PersonId[], parentId: PersonId): PersonId {
  return parents.find((id) => id !== parentId) ?? parentId
}

// --- Helpers ----------------------------------------------------------------

/** Oldest first; people without a birth date keep their relative order at the end. */
function byBirth(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    if (!a.birthDate) return b.birthDate ? 1 : 0
    if (!b.birthDate) return -1
    return a.birthDate.localeCompare(b.birthDate)
  })
}

function distancesFrom(graph: FamilyGraph, startId: PersonId): Map<PersonId, number> {
  const distances = new Map([[startId, 0]])
  let frontier = [startId]
  for (let distance = 1; frontier.length > 0; distance++) {
    const next: PersonId[] = []
    for (const id of frontier) {
      const neighbours = [
        ...parentIdsOf(graph, id),
        ...childIdsOf(graph, id),
        ...partnerIdsOf(graph, id),
      ]
      for (const neighbour of neighbours) {
        if (distances.has(neighbour)) continue
        distances.set(neighbour, distance)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return distances
}
