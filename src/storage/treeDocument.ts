import {
  isFuzzyDate,
  type FamilyGraph,
  type Gender,
  type ParentKind,
  type ParentLink,
  type Partnership,
  type PartnershipStatus,
  type Person,
  type PersonId,
} from '../model'

export const TREE_FORMAT = 'kingraph-tree'
export const TREE_VERSION = 1

/** How a tree is stored on this device and written to backup files. */
export interface TreeDocument {
  format: typeof TREE_FORMAT
  version: number
  savedAt: string
  graph: FamilyGraph
}

/** Thrown when stored or imported data isn't a usable family tree. */
export class TreeFileError extends Error {
  override name = 'TreeFileError'
}

export function toDocument(graph: FamilyGraph, now = new Date()): TreeDocument {
  return { format: TREE_FORMAT, version: TREE_VERSION, savedAt: now.toISOString(), graph }
}

/**
 * Upgrades a document from version `n` to `n + 1`. Add an entry whenever the
 * format changes so older saved trees and backups keep opening.
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {}

/**
 * Checks that data loaded from storage or a backup file is a valid family
 * tree and returns a clean copy of it, keeping only known fields.
 */
export function parseTreeDocument(data: unknown): FamilyGraph {
  if (!isRecord(data) || data.format !== TREE_FORMAT) {
    throw new TreeFileError('This isn’t a KinGraph family tree file.')
  }
  const { version } = data
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new TreeFileError('This file has an unrecognised version.')
  }
  if (version > TREE_VERSION) {
    throw new TreeFileError(
      'This file was made by a newer version of KinGraph. Update the app to open it.',
    )
  }

  let doc = data
  for (let v = version; v < TREE_VERSION; v++) doc = MIGRATIONS[v](doc)
  return parseGraph(doc.graph)
}

// --- Validation ---------------------------------------------------------------

const GENDERS: readonly Gender[] = ['female', 'male', 'other']
const PARENT_KINDS: readonly ParentKind[] = ['biological', 'adoptive', 'foster']
const STATUSES: readonly PartnershipStatus[] = [
  'married',
  'partnered',
  'separated',
  'divorced',
  'widowed',
]

function damaged(detail: string): TreeFileError {
  return new TreeFileError(`This family tree is damaged: ${detail}`)
}

function parseGraph(raw: unknown): FamilyGraph {
  if (!isRecord(raw) || !isRecord(raw.people)) throw damaged('it has no people.')

  const people: Record<PersonId, Person> = {}
  for (const [key, value] of Object.entries(raw.people)) {
    people[key] = parsePerson(key, value)
  }

  const { managerId } = raw
  if (typeof managerId !== 'string' || !people[managerId] || people[managerId].isPlaceholder) {
    throw damaged('it doesn’t say whose tree it is.')
  }

  const exists = (id: unknown): id is PersonId => typeof id === 'string' && id in people
  const parentLinks = parseList(raw.parentLinks, 'parent links', (link): ParentLink => {
    if (!isRecord(link) || !exists(link.parentId) || !exists(link.childId)) {
      throw damaged('a parent link refers to someone who isn’t in the tree.')
    }
    if (link.parentId === link.childId) throw damaged('someone is listed as their own parent.')
    return {
      parentId: link.parentId,
      childId: link.childId,
      kind: oneOf(link.kind, PARENT_KINDS, 'a parent link has an unknown kind.'),
    }
  })
  const partnerships = parseList(raw.partnerships, 'partnerships', (p): Partnership => {
    if (!isRecord(p) || typeof p.id !== 'string' || !Array.isArray(p.partnerIds)) {
      throw damaged('a partnership is malformed.')
    }
    const [a, b] = p.partnerIds
    if (p.partnerIds.length !== 2 || !exists(a) || !exists(b) || a === b) {
      throw damaged('a partnership refers to someone who isn’t in the tree.')
    }
    return {
      id: p.id,
      partnerIds: [a, b],
      status: oneOf(p.status, STATUSES, 'a partnership has an unknown status.'),
      startDate: optionalDate(p.startDate),
      endDate: optionalDate(p.endDate),
    }
  })

  checkParentLinks(parentLinks)
  checkPartnerships(partnerships)
  return { managerId, people, parentLinks, partnerships }
}

function parsePerson(key: string, value: unknown): Person {
  if (!isRecord(value) || value.id !== key || typeof value.givenName !== 'string') {
    throw damaged('a person is missing their id or name.')
  }
  if (value.familyName !== undefined && typeof value.familyName !== 'string') {
    throw damaged(`${value.givenName}’s last name isn’t text.`)
  }
  if (value.isPlaceholder !== undefined && typeof value.isPlaceholder !== 'boolean') {
    throw damaged(`${value.givenName} has an invalid placeholder flag.`)
  }
  return {
    id: key,
    givenName: value.givenName,
    familyName: value.familyName,
    gender:
      value.gender === undefined
        ? undefined
        : oneOf(value.gender, GENDERS, `${value.givenName} has an unknown gender value.`),
    birthDate: optionalDate(value.birthDate),
    deathDate: optionalDate(value.deathDate),
    isPlaceholder: value.isPlaceholder || undefined,
  }
}

function checkParentLinks(links: ParentLink[]) {
  const seen = new Set<string>()
  const biological = new Map<PersonId, number>()
  for (const { parentId, childId, kind } of links) {
    const key = `${parentId}>${childId}`
    if (seen.has(key)) throw damaged('a parent link appears twice.')
    seen.add(key)
    if (kind === 'biological') {
      const count = (biological.get(childId) ?? 0) + 1
      if (count > 2) throw damaged('someone has more than two biological parents.')
      biological.set(childId, count)
    }
  }

  // Nobody can be their own ancestor: walk up from each person and look for a loop.
  const parentsOf = new Map<PersonId, PersonId[]>()
  for (const { parentId, childId } of links) {
    parentsOf.set(childId, [...(parentsOf.get(childId) ?? []), parentId])
  }
  const done = new Set<PersonId>()
  const visiting = new Set<PersonId>()
  const visit = (id: PersonId) => {
    if (done.has(id)) return
    if (visiting.has(id)) throw damaged('someone is listed as their own ancestor.')
    visiting.add(id)
    for (const parentId of parentsOf.get(id) ?? []) visit(parentId)
    visiting.delete(id)
    done.add(id)
  }
  for (const id of parentsOf.keys()) visit(id)
}

function checkPartnerships(partnerships: Partnership[]) {
  const ids = new Set<string>()
  const pairs = new Set<string>()
  for (const { id, partnerIds } of partnerships) {
    const pair = [...partnerIds].sort().join('+')
    if (ids.has(id) || pairs.has(pair)) throw damaged('a partnership appears twice.')
    ids.add(id)
    pairs.add(pair)
  }
}

function parseList<T>(raw: unknown, what: string, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(raw)) throw damaged(`its ${what} are missing.`)
  return raw.map(parse)
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (!allowed.includes(value as T)) throw damaged(message)
  return value as T
}

function optionalDate(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !isFuzzyDate(value)) throw damaged('a date isn’t valid.')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
