import { t } from '../i18n'
import {
  childIdsOf,
  getPerson,
  isAncestor,
  parentIdsOf,
  partnerIdsOf,
  partnershipBetween,
  siblingsOf,
} from './queries'
import type {
  FamilyGraph,
  NewPerson,
  ParentKind,
  Partnership,
  PartnershipStatus,
  Person,
  PersonId,
} from './types'

/** Thrown when an edit would make the family graph inconsistent. */
export class GraphError extends Error {
  override name = 'GraphError'
}

export interface PersonResult {
  graph: FamilyGraph
  person: Person
}

const newId = () => crypto.randomUUID()

export function createGraph(manager: NewPerson): FamilyGraph {
  const person = { ...manager, id: newId() }
  return {
    managerId: person.id,
    people: { [person.id]: person },
    parentLinks: [],
    partnerships: [],
  }
}

// --- People -----------------------------------------------------------------

export function addPerson(graph: FamilyGraph, input: NewPerson): PersonResult {
  const person = { ...input, id: newId() }
  return { graph: { ...graph, people: { ...graph.people, [person.id]: person } }, person }
}

export function updatePerson(
  graph: FamilyGraph,
  id: PersonId,
  patch: Partial<NewPerson>,
): FamilyGraph {
  const person = { ...getPerson(graph, id), ...patch }
  return { ...graph, people: { ...graph.people, [id]: person } }
}

/** Removes a person and every link to them. The manager can't be removed. */
export function removePerson(graph: FamilyGraph, id: PersonId): FamilyGraph {
  getPerson(graph, id)
  if (id === graph.managerId) throw new GraphError(t('graph.noRemoveManager'))
  const { [id]: _removed, ...people } = graph.people
  return prunePlaceholders({
    ...graph,
    people,
    parentLinks: graph.parentLinks.filter((l) => l.parentId !== id && l.childId !== id),
    partnerships: graph.partnerships.filter((p) => !p.partnerIds.includes(id)),
  })
}

// --- Parent links -------------------------------------------------------------

export function linkParent(
  graph: FamilyGraph,
  parentId: PersonId,
  childId: PersonId,
  kind: ParentKind = 'biological',
): FamilyGraph {
  getPerson(graph, parentId)
  getPerson(graph, childId)
  if (parentId === childId) throw new GraphError(t('graph.ownParent'))
  if (graph.parentLinks.some((l) => l.parentId === parentId && l.childId === childId)) {
    throw new GraphError(t('graph.alreadyLinked'))
  }
  if (isAncestor(graph, childId, parentId)) {
    throw new GraphError(t('graph.ownAncestor'))
  }
  if (kind === 'biological' && parentIdsOf(graph, childId, ['biological']).length >= 2) {
    throw new GraphError(t('graph.twoParents'))
  }
  return { ...graph, parentLinks: [...graph.parentLinks, { parentId, childId, kind }] }
}

export function unlinkParent(
  graph: FamilyGraph,
  parentId: PersonId,
  childId: PersonId,
): FamilyGraph {
  return prunePlaceholders({
    ...graph,
    parentLinks: graph.parentLinks.filter(
      (l) => !(l.parentId === parentId && l.childId === childId),
    ),
  })
}

// --- Partnerships -------------------------------------------------------------

export function linkPartners(
  graph: FamilyGraph,
  a: PersonId,
  b: PersonId,
  details: Partial<Omit<Partnership, 'id' | 'partnerIds'>> = {},
): FamilyGraph {
  getPerson(graph, a)
  getPerson(graph, b)
  if (a === b) throw new GraphError(t('graph.selfPartner'))
  if (partnershipBetween(graph, a, b)) {
    throw new GraphError(t('graph.alreadyPartners'))
  }
  const partnership: Partnership = {
    status: 'partnered',
    ...details,
    id: newId(),
    partnerIds: [a, b],
  }
  return { ...graph, partnerships: [...graph.partnerships, partnership] }
}

export function updatePartnership(
  graph: FamilyGraph,
  id: string,
  patch: Partial<Omit<Partnership, 'id' | 'partnerIds'>>,
): FamilyGraph {
  if (!graph.partnerships.some((p) => p.id === id)) {
    throw new GraphError(t('graph.unknownPartnership', { id }))
  }
  return {
    ...graph,
    partnerships: graph.partnerships.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }
}

export function unlinkPartners(graph: FamilyGraph, id: string): FamilyGraph {
  return { ...graph, partnerships: graph.partnerships.filter((p) => p.id !== id) }
}

// --- Adding relatives -----------------------------------------------------------

export interface AddParentOptions {
  kind?: ParentKind
  /**
   * Siblings who get the same parent. Defaults to full siblings with exactly
   * the same recorded parents, since a parent added for one of them almost
   * always belongs to the others too.
   */
  siblingIds?: PersonId[]
}

/**
 * Adds a parent to a person. If the person has a placeholder parent (created
 * when a sibling was added before any parents), the placeholder is filled in
 * instead, so every child linked through it gets the real parent.
 */
export function addParent(
  graph: FamilyGraph,
  childId: PersonId,
  input: NewPerson,
  { kind = 'biological', siblingIds }: AddParentOptions = {},
): PersonResult {
  const placeholderId = parentIdsOf(graph, childId, ['biological']).find(
    (id) => graph.people[id]?.isPlaceholder,
  )
  if (kind === 'biological' && placeholderId) {
    const filled = updatePerson(graph, placeholderId, { ...input, isPlaceholder: false })
    return { graph: filled, person: getPerson(filled, placeholderId) }
  }

  const siblings = siblingIds ?? fullSiblingsWithSameParents(graph, childId)
  const added = addPerson(graph, input)
  const next = [childId, ...siblings].reduce(
    (g, id) => linkParent(g, added.person.id, id, kind),
    added.graph,
  )
  return { graph: next, person: added.person }
}

export interface AddChildOptions {
  kind?: ParentKind
  /**
   * The child's other parent. Defaults to the parent's only ongoing partner,
   * if they have exactly one. Pass `null` to add the child with one parent.
   */
  coParentId?: PersonId | null
}

export function addChild(
  graph: FamilyGraph,
  parentId: PersonId,
  input: NewPerson,
  { kind = 'biological', coParentId }: AddChildOptions = {},
): PersonResult {
  getPerson(graph, parentId)
  if (coParentId === undefined) {
    const partners = partnerIdsOf(graph, parentId, { ongoingOnly: true })
    coParentId = partners.length === 1 ? partners[0] : null
  }

  const added = addPerson(graph, input)
  let next = linkParent(added.graph, parentId, added.person.id, kind)
  if (coParentId) next = linkParent(next, coParentId, added.person.id, kind)
  return { graph: next, person: added.person }
}

export interface AddSiblingOptions {
  kind?: ParentKind
  /**
   * The parents the sibling shares with the person; pass a subset for a
   * half-sibling. Defaults to all of the person's parents.
   */
  sharedParentIds?: PersonId[]
}

/**
 * Adds a sibling by linking them to the person's parents. If the person has
 * no parents recorded yet, a placeholder parent is created to link them,
 * which `addParent` later fills in.
 */
export function addSibling(
  graph: FamilyGraph,
  personId: PersonId,
  input: NewPerson,
  { kind = 'biological', sharedParentIds }: AddSiblingOptions = {},
): PersonResult {
  getPerson(graph, personId)
  const parents = parentIdsOf(graph, personId)
  const shared = [...(sharedParentIds ?? parents)]
  const notParent = shared.find((id) => !parents.includes(id))
  if (notParent) throw new GraphError(t('graph.notAParent', { parent: notParent, child: personId }))

  let next = graph
  if (shared.length === 0) {
    if (sharedParentIds) throw new GraphError(t('graph.siblingNeedsParent'))
    const placeholder = addPerson(graph, { givenName: 'Unknown', isPlaceholder: true })
    next = linkParent(placeholder.graph, placeholder.person.id, personId)
    shared.push(placeholder.person.id)
  }

  const added = addPerson(next, input)
  next = added.graph
  for (const parentId of shared) next = linkParent(next, parentId, added.person.id, kind)
  return { graph: next, person: added.person }
}

export function addPartner(
  graph: FamilyGraph,
  personId: PersonId,
  input: NewPerson,
  status: PartnershipStatus = 'partnered',
): PersonResult {
  getPerson(graph, personId)
  const { graph: next, person } = addPerson(graph, input)
  return { graph: linkPartners(next, personId, person.id, { status }), person }
}

// --- Helpers ----------------------------------------------------------------

function fullSiblingsWithSameParents(graph: FamilyGraph, personId: PersonId): PersonId[] {
  const parents = parentIdsOf(graph, personId)
  return siblingsOf(graph, personId)
    .filter(({ id, type }) => {
      if (type !== 'full') return false
      const theirs = parentIdsOf(graph, id)
      return theirs.length === parents.length && theirs.every((p) => parents.includes(p))
    })
    .map(({ id }) => id)
}

/** A placeholder parent only matters while it links two or more children. */
function prunePlaceholders(graph: FamilyGraph): FamilyGraph {
  const orphaned = Object.values(graph.people).filter(
    (p) => p.isPlaceholder && childIdsOf(graph, p.id).length < 2,
  )
  return orphaned.reduce((g, p) => removePerson(g, p.id), graph)
}
