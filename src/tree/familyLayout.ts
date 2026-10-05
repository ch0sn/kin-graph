import { Position, type Edge, type Node, type NodeHandle } from '@xyflow/react'
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
import { compareSiblings, DEFAULT_SIBLING_ORDER, type SiblingOrder } from './siblingOrder'

export const PERSON_WIDTH = 232
export const PERSON_HEIGHT = 76
export const UNION_SIZE = 10
/** Horizontal space between partners, where the union dot sits. */
export const PARTNER_GAP = 48

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
  /** The member whose place among their siblings decides where the block goes. */
  keyId: PersonId
}

export interface PersonNodeData extends Record<string, unknown> {
  person: Person
  label: string | null
  isManager: boolean
  /** Steps from the manager through parent, child and partner links. */
  distance: number
  /** Seconds to wait before animating in; set by the view, not the layout. */
  entranceDelay?: number
}

export interface UnionNodeData extends Record<string, unknown> {
  distance: number
  entranceDelay?: number
}

export type PersonNode = Node<PersonNodeData, 'person'>
export type UnionNode = Node<UnionNodeData, 'union'>
export type TreeNode = PersonNode | UnionNode

/**
 * Where lines attach to a node, matching the zero-size handles in nodes.tsx:
 * the middle of each side. Given up front so React Flow can draw the lines
 * straight away; otherwise it waits to measure the handles on the page, and a
 * hidden tab or remounted cards leave the tree without lines until it does.
 */
function sideHandles(
  width: number,
  height: number,
  types: Record<'top' | 'left' | 'right' | 'bottom', NodeHandle['type']>,
): NodeHandle[] {
  const at = { top: [width / 2, 0], left: [0, height / 2], right: [width, height / 2], bottom: [width / 2, height] }
  const positions = { top: Position.Top, left: Position.Left, right: Position.Right, bottom: Position.Bottom }
  return (Object.keys(types) as (keyof typeof types)[]).map((id) => ({
    id,
    type: types[id],
    position: positions[id],
    x: at[id][0],
    y: at[id][1],
    width: 0,
    height: 0,
  }))
}

const PERSON_HANDLES = sideHandles(PERSON_WIDTH, PERSON_HEIGHT, {
  top: 'target',
  left: 'source',
  right: 'source',
  bottom: 'source',
})

const UNION_HANDLES = sideHandles(UNION_SIZE, UNION_SIZE, {
  top: 'target',
  left: 'target',
  right: 'target',
  bottom: 'source',
})

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
  // Blocks are passed in sibling order, which ELK uses to break ties. The
  // final order is set by orderSiblings.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

const MAX_FLIP_PASSES = 3

export function deriveUnions(
  graph: FamilyGraph,
  compare = compareSiblings(DEFAULT_SIBLING_ORDER),
): Union[] {
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
  for (const child of Object.values(graph.people).sort(compare)) {
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
export async function layoutFamily(
  graph: FamilyGraph,
  elk: ELK,
  { siblingOrder = DEFAULT_SIBLING_ORDER }: { siblingOrder?: SiblingOrder } = {},
): Promise<FamilyLayout> {
  const isVisible = (id: PersonId) => !graph.people[id]?.isPlaceholder
  const compare = compareSiblings(siblingOrder)
  const unions = deriveUnions(graph, compare)
  const distances = distancesFrom(graph, graph.managerId)
  let blocks = partnerBlocks(graph, unions, isVisible, compare, distances)

  // First let ELK find an arrangement with few crossing lines.
  let positions = await runElk(elk, blocks, unions, isVisible)
  // ELK can't reorder people inside a block, so flip any couple whose members
  // sit on the wrong side of their own parents and lay out again.
  for (let pass = 0; pass < MAX_FLIP_PASSES; pass++) {
    const flipped = flipBlocksTowardParents(blocks, unions, positions, isVisible)
    if (flipped === blocks) break
    blocks = flipped
    positions = await runElk(elk, blocks, unions, isVisible)
  }

  // ELK doesn't keep siblings in a chosen order, so put them in order
  // ourselves and have ELK lay out exactly that order.
  const order = orderSiblings(blocks, unions, positions, isVisible)
  positions = await runElk(elk, blocks, unions, isVisible, order)
  const flipped = flipBlocksTowardParents(blocks, unions, positions, isVisible)
  if (flipped !== blocks) {
    blocks = flipped
    positions = await runElk(elk, blocks, unions, isVisible, order)
  }

  return toReactFlow(graph, blocks, unions, positions, isVisible, distances)
}

// --- Blocks -----------------------------------------------------------------

/**
 * Groups partners into blocks, ordered for the layout by sibling order.
 * ELK keeps that order within each generation, so it decides how brothers
 * and sisters line up.
 */
function partnerBlocks(
  graph: FamilyGraph,
  unions: Union[],
  isVisible: (id: PersonId) => boolean,
  compare: (a: Person, b: Person) => number,
  distances: Map<PersonId, number>,
): Block[] {
  const people = Object.values(graph.people)
    .filter((p) => isVisible(p.id))
    .sort(compare)
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
    blocks.push({ id: `block:${memberIds.join('+')}`, memberIds, keyId: memberIds[0] })
  }

  // A couple takes its place among the siblings of one partner: one who is a
  // child in the tree, so someone who married in doesn't decide the order,
  // and of those the one closest to the manager, since this is their tree.
  const rank = new Map(people.map((p, i) => [p.id, i]))
  const hasParents = (id: PersonId) => parentIdsOf(graph, id).some(isVisible)
  const closeness = (id: PersonId) => distances.get(id) ?? Infinity
  for (const block of blocks) {
    const children = block.memberIds.filter(hasParents)
    ;[block.keyId] = (children.length > 0 ? children : block.memberIds).toSorted(
      (a, b) => closeness(a) - closeness(b) || rank.get(a)! - rank.get(b)!,
    )
  }
  return blocks.sort((a, b) => rank.get(a.keyId)! - rank.get(b.keyId)!)
}

/** Something ELK places in a generation's row: a block or a free-standing union. */
interface RowItem {
  id: string
  width: number
  /** Where the first layout put it. */
  x: number
  y: number
  /** The family it's a child of, if any; siblings share one. */
  parentUnion?: Union
  /** Its position among its siblings, in sibling order. */
  siblingRank: number
  /** Items in the row below that hang from it. */
  childIds: string[]
}

/**
 * Takes ELK's first arrangement and returns the order to keep, as positions
 * per item. Going down generation by generation, each row follows its
 * parents and each family's children are put in sibling order, in the
 * places they already took up. Then, going back up, people whose parents
 * aren't in the tree (often in-laws) move over their children.
 */
function orderSiblings(
  blocks: Block[],
  unions: Union[],
  positions: Positions,
  isVisible: (id: PersonId) => boolean,
): Positions {
  const blockOf = blockIndex(blocks)
  const unionOfChild = new Map(unions.flatMap((u) => u.childIds.map((id) => [id, u] as const)))
  const sourceOf = (union: Union) => {
    const parents = union.parentIds.filter(isVisible)
    return parents.length > 0 ? blockOf.get(parents[0])!.id : union.id
  }

  const items = new Map<string, RowItem>()
  for (const block of blocks) {
    const parentUnion = unionOfChild.get(block.keyId)
    items.set(block.id, {
      id: block.id,
      width: blockWidth(block),
      ...positions.get(block.id)!,
      parentUnion,
      siblingRank: parentUnion ? parentUnion.childIds.indexOf(block.keyId) : 0,
      childIds: [],
    })
  }
  for (const union of unions) {
    if (positions.has(union.id)) {
      items.set(union.id, {
        id: union.id,
        width: UNION_SIZE,
        ...positions.get(union.id)!,
        siblingRank: 0,
        childIds: [],
      })
    }
  }
  for (const item of items.values()) {
    if (item.parentUnion) items.get(sourceOf(item.parentUnion))?.childIds.push(item.id)
  }

  // Estimated left edges as rows are rearranged, in the first layout's coordinates.
  const estimate = new Map([...items.values()].map((item) => [item.id, item.x]))
  const centre = (item: RowItem) => estimate.get(item.id)! + item.width / 2
  const anchorOf = (union: Union) => {
    const source = items.get(sourceOf(union))
    if (!source) return undefined
    const parents = union.parentIds.filter(isVisible)
    return parents.length > 0
      ? estimate.get(source.id)! + unionAnchorX(blockOf.get(parents[0])!, parents)
      : centre(source)
  }

  const rows = new Map<number, RowItem[]>()
  for (const item of items.values()) rows.set(item.y, [...(rows.get(item.y) ?? []), item])
  const rowsTopDown = [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)

  /** Orders a row by `target`, keeping each family's children in sibling order. */
  const arrange = (row: RowItem[], target: (item: RowItem) => number) => {
    const slots = row.map((item) => item.x).sort((a, b) => a - b)
    const ordered = row.toSorted((a, b) => target(a) - target(b) || a.x - b.x)
    const families = new Map<Union, number[]>()
    ordered.forEach((item, i) => {
      if (item.parentUnion) families.set(item.parentUnion, [...(families.get(item.parentUnion) ?? []), i])
    })
    for (const indexes of families.values()) {
      const siblings = indexes.map((i) => ordered[i]).sort((a, b) => a.siblingRank - b.siblingRank)
      indexes.forEach((i, k) => (ordered[i] = siblings[k]))
    }
    ordered.forEach((item, i) => estimate.set(item.id, slots[i]))
  }

  for (const row of rowsTopDown) {
    arrange(row, (item) => (item.parentUnion && anchorOf(item.parentUnion)) ?? centre(item))
  }
  const isRootWithChildren = (item: RowItem) => !item.parentUnion && item.childIds.length > 0
  for (const row of rowsTopDown.toReversed()) {
    if (!row.some(isRootWithChildren)) continue
    arrange(row, (item) => {
      if (!isRootWithChildren(item)) return centre(item)
      const below = item.childIds.map((id) => centre(items.get(id)!))
      return below.reduce((sum, x) => sum + x, 0) / below.length
    })
  }

  return new Map([...items.values()].map((item) => [item.id, { x: estimate.get(item.id)!, y: item.y }]))
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
  /** When given, ELK keeps the order of these positions within each row. */
  order?: Positions,
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
      freeUnions.push({ id: union.id, width: UNION_SIZE, height: UNION_SIZE, ...order?.get(union.id) })
    }
    for (const childId of union.childIds) {
      if (!isVisible(childId)) continue
      edges.push({ id: `${union.id}->${childId}`, sources: [source], targets: [inPort(childId)] })
    }
  }

  const laidOut = await elk.layout({
    id: 'family',
    layoutOptions: order
      ? { ...LAYOUT_OPTIONS, 'elk.layered.crossingMinimization.strategy': 'INTERACTIVE' }
      : LAYOUT_OPTIONS,
    children: [
      ...blocks.map((block) => ({
        id: block.id,
        width: blockWidth(block),
        height: PERSON_HEIGHT,
        ports: ports.get(block.id),
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ...order?.get(block.id),
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
  distances: Map<PersonId, number>,
): FamilyLayout {
  const blockOf = blockIndex(blocks)
  const nodes: TreeNode[] = []
  const edges: Edge[] = []
  const families: Family[] = []

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
        handles: PERSON_HANDLES,
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
    /** Where the children's lines start, and the bottom of the row they start in. */
    let from: { x: number; y: number; rowBottom: number }
    if (parents.length === 1) {
      // A single parent's children hang straight from them.
      childSource = { source: parents[0], sourceHandle: 'bottom' }
      const block = blockOf.get(parents[0])!
      const origin = positions.get(block.id)!
      const x = origin.x + slotX(block.memberIds.indexOf(parents[0]))
      from = { x, y: origin.y + PERSON_HEIGHT, rowBottom: origin.y + PERSON_HEIGHT }
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
        handles: UNION_HANDLES,
        selectable: false,
        data: { distance },
      })
      childSource = { source: union.id, sourceHandle: 'bottom' }
      from = {
        x: position.x + UNION_SIZE / 2,
        y: position.y + UNION_SIZE,
        rowBottom: block ? positions.get(block.id)!.y + PERSON_HEIGHT : position.y + UNION_SIZE,
      }

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
      const edge: FamilyEdge = {
        id: `${union.id}->${childId}`,
        type: 'family',
        ...childSource,
        target: childId,
        targetHandle: 'top',
        className: nonBiological ? 'edge-nonbiological' : undefined,
        data: { busOffset: 0 },
      }
      edges.push(edge)

      // Group the lines by the row the child is in; each group shares one bus.
      const child = nodes.find((n) => n.id === childId)!
      const childTop = child.position.y
      let family = families.find((f) => f.unionId === union.id && f.childTop === childTop)
      if (!family) {
        family = { unionId: union.id, from, childTop, childXs: [], edges: [] }
        families.push(family)
      }
      family.childXs.push(child.position.x + PERSON_WIDTH / 2)
      family.edges.push(edge)
    }
  }

  assignBusLanes(families)
  return { nodes, edges }
}

export type FamilyEdge = Edge<{ busOffset: number }, 'family'>

/** One family's lines down to the children in one row. */
interface Family {
  unionId: string
  from: { x: number; y: number; rowBottom: number }
  childTop: number
  childXs: number[]
  edges: FamilyEdge[]
}

/** Keeps buses of different families this far apart where they'd overlap. */
const BUS_CLEARANCE = 16

/**
 * Children's lines run straight down from their parents to a horizontal bus
 * in the gap between the rows, then straight down to each child, so they
 * never pass behind a card. Families whose buses would overlap in the same
 * gap get separate levels, so their lines don't merge.
 */
function assignBusLanes(families: Family[]) {
  const gaps = new Map<number, Family[]>()
  for (const family of families) {
    gaps.set(family.childTop, [...(gaps.get(family.childTop) ?? []), family])
  }

  for (const [childTop, group] of gaps) {
    const gapTop = Math.max(...group.map((f) => f.from.rowBottom))
    const span = (f: Family) => [Math.min(f.from.x, ...f.childXs), Math.max(f.from.x, ...f.childXs)]
    // Greedy interval colouring: each family takes the first level free along its span.
    const laneEnds: number[] = []
    const lanes = new Map<Family, number>()
    for (const family of group.toSorted((a, b) => span(a)[0] - span(b)[0])) {
      const [start, end] = span(family)
      let lane = laneEnds.findIndex((laneEnd) => laneEnd + BUS_CLEARANCE <= start)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = end
      lanes.set(family, lane)
    }
    const step = (childTop - gapTop) / (laneEnds.length + 1)
    for (const [family, lane] of lanes) {
      const busY = gapTop + step * (lane + 1)
      for (const edge of family.edges) edge.data = { busOffset: childTop - busY }
    }
  }
}

function otherParent(parents: PersonId[], parentId: PersonId): PersonId {
  return parents.find((id) => id !== parentId) ?? parentId
}

// --- Helpers ----------------------------------------------------------------

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
