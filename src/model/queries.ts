import type {
  FamilyGraph,
  ParentKind,
  Partnership,
  PartnershipStatus,
  Person,
  PersonId,
} from './types'

/** Partnerships that still make someone family: not separated or divorced. */
const ONGOING_STATUSES: ReadonlySet<PartnershipStatus> = new Set([
  'married',
  'partnered',
  'widowed',
])

export function isOngoing(partnership: Partnership): boolean {
  return ONGOING_STATUSES.has(partnership.status)
}

export function getPerson(graph: FamilyGraph, id: PersonId): Person {
  const person = graph.people[id]
  if (!person) throw new Error(`Unknown person: ${id}`)
  return person
}

export function parentIdsOf(
  graph: FamilyGraph,
  childId: PersonId,
  kinds?: readonly ParentKind[],
): PersonId[] {
  return graph.parentLinks
    .filter((l) => l.childId === childId && (!kinds || kinds.includes(l.kind)))
    .map((l) => l.parentId)
}

export function childIdsOf(graph: FamilyGraph, parentId: PersonId): PersonId[] {
  return graph.parentLinks
    .filter((l) => l.parentId === parentId)
    .map((l) => l.childId)
}

export function partnershipsOf(
  graph: FamilyGraph,
  personId: PersonId,
): Partnership[] {
  return graph.partnerships.filter((p) => p.partnerIds.includes(personId))
}

export function partnerOf(partnership: Partnership, personId: PersonId): PersonId {
  const [a, b] = partnership.partnerIds
  return a === personId ? b : a
}

export function partnerIdsOf(
  graph: FamilyGraph,
  personId: PersonId,
  { ongoingOnly = false } = {},
): PersonId[] {
  return partnershipsOf(graph, personId)
    .filter((p) => !ongoingOnly || isOngoing(p))
    .map((p) => partnerOf(p, personId))
}

export function partnershipBetween(
  graph: FamilyGraph,
  a: PersonId,
  b: PersonId,
): Partnership | undefined {
  return graph.partnerships.find(
    (p) => p.partnerIds.includes(a) && p.partnerIds.includes(b),
  )
}

/**
 * The parent a newly added parent of the given kind would share the child
 * with: the one existing parent of that kind. Null when there are none or
 * several, since then it isn't clear who the new parent's partner is.
 */
export function coParentFor(graph: FamilyGraph, childId: PersonId, kind: ParentKind): PersonId | null {
  const parents = parentIdsOf(graph, childId, [kind]).filter((id) => !graph.people[id]?.isPlaceholder)
  return parents.length === 1 ? parents[0] : null
}

/**
 * People who share a child with this person but aren't recorded as their
 * partner, e.g. a mother and father entered separately.
 */
export function unlinkedCoParentIdsOf(graph: FamilyGraph, personId: PersonId): PersonId[] {
  const coParents = new Set<PersonId>()
  for (const childId of childIdsOf(graph, personId)) {
    for (const parentId of parentIdsOf(graph, childId)) {
      if (parentId === personId || graph.people[parentId]?.isPlaceholder) continue
      if (!partnershipBetween(graph, personId, parentId)) coParents.add(parentId)
    }
  }
  return [...coParents]
}

/** Partners of a person's parents who aren't themselves that person's parent. */
export function stepParentIdsOf(graph: FamilyGraph, personId: PersonId): PersonId[] {
  const parents = new Set(parentIdsOf(graph, personId))
  const stepParents = new Set<PersonId>()
  for (const parentId of parents) {
    for (const partnerId of partnerIdsOf(graph, parentId, { ongoingOnly: true })) {
      if (!parents.has(partnerId) && partnerId !== personId) stepParents.add(partnerId)
    }
  }
  return [...stepParents]
}

export type SiblingType = 'full' | 'half' | 'step'

export interface Sibling {
  id: PersonId
  type: SiblingType
}

/**
 * Siblings are derived from shared parents. They are "half" when each has a
 * parent the other doesn't; an unrecorded parent is not treated as a
 * difference. Step-siblings are children of a step-parent who share no parent.
 */
export function siblingsOf(graph: FamilyGraph, personId: PersonId): Sibling[] {
  const parents = parentIdsOf(graph, personId)
  const siblings = new Map<PersonId, SiblingType>()

  for (const parentId of parents) {
    for (const childId of childIdsOf(graph, parentId)) {
      if (childId === personId || siblings.has(childId)) continue
      siblings.set(childId, isHalf(graph, personId, childId) ? 'half' : 'full')
    }
  }
  for (const stepParentId of stepParentIdsOf(graph, personId)) {
    for (const childId of childIdsOf(graph, stepParentId)) {
      if (childId !== personId && !siblings.has(childId)) siblings.set(childId, 'step')
    }
  }
  return [...siblings].map(([id, type]) => ({ id, type }))
}

/** Whether two people who share a parent each also have a parent the other lacks. */
export function isHalf(graph: FamilyGraph, a: PersonId, b: PersonId): boolean {
  const parentsA = parentIdsOf(graph, a)
  const parentsB = parentIdsOf(graph, b)
  return (
    parentsA.some((p) => !parentsB.includes(p)) &&
    parentsB.some((p) => !parentsA.includes(p))
  )
}

export interface Lineage {
  /** Generations between the start person and this relative (0 = themselves). */
  distance: number
  /**
   * The next person on the path back towards the start: the child of this
   * relative for ancestors, the parent for descendants. Absent for the start.
   */
  via?: PersonId
}

/** Every ancestor of a person, including themselves, by shortest path. */
export function ancestorsOf(graph: FamilyGraph, personId: PersonId): Map<PersonId, Lineage> {
  return walk(personId, (id) => parentIdsOf(graph, id))
}

/** Every descendant of a person, including themselves, by shortest path. */
export function descendantsOf(
  graph: FamilyGraph,
  personId: PersonId,
): Map<PersonId, Lineage> {
  return walk(personId, (id) => childIdsOf(graph, id))
}

export function isAncestor(
  graph: FamilyGraph,
  ancestorId: PersonId,
  personId: PersonId,
): boolean {
  return ancestorId !== personId && ancestorsOf(graph, personId).has(ancestorId)
}

function walk(
  startId: PersonId,
  next: (id: PersonId) => PersonId[],
): Map<PersonId, Lineage> {
  const seen = new Map<PersonId, Lineage>([[startId, { distance: 0 }]])
  let frontier = [startId]
  for (let distance = 1; frontier.length > 0; distance++) {
    const nextFrontier: PersonId[] = []
    for (const id of frontier) {
      for (const relativeId of next(id)) {
        if (seen.has(relativeId)) continue
        seen.set(relativeId, { distance, via: id })
        nextFrontier.push(relativeId)
      }
    }
    frontier = nextFrontier
  }
  return seen
}
