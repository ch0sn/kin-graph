import { t } from '../i18n'
import {
  EVENT_TYPES,
  isFuzzyDate,
  isKindOf,
  type EventType,
  type FamilyGraph,
  type Gender,
  type LifeEvent,
  type NameForm,
  type NameScript,
  type NameType,
  type ParentKind,
  type ParentLink,
  type Partnership,
  type PartnershipStatus,
  type Person,
  type PersonId,
  type PersonName,
} from '../model'

export const TREE_FORMAT = 'kingraph-tree'
export const TREE_VERSION = 4

/** How a tree is stored on this device and written to backup files. */
export interface TreeDocument {
  format: typeof TREE_FORMAT
  version: number
  savedAt: string
  graph: FamilyGraph
  /** Backups only: photos by id, as data URLs. On the device they're stored separately. */
  photos?: Record<string, string>
}

/** Thrown when stored or imported data isn't a usable family tree. */
export class TreeFileError extends Error {
  override name = 'TreeFileError'
}

export function toDocument(
  graph: FamilyGraph,
  now = new Date(),
  photos?: Record<string, string>,
): TreeDocument {
  return {
    format: TREE_FORMAT,
    version: TREE_VERSION,
    savedAt: now.toISOString(),
    graph,
    ...(photos && { photos }),
  }
}

/**
 * Upgrades a document from version `n` to `n + 1`. Add an entry whenever the
 * format changes so older saved trees and backups keep opening.
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  // v2 added optional `deceased` and `photoId` to people and `photos` to backups.
  1: (doc) => ({ ...doc, version: 2 }),
  // v3 replaced `givenName` and `familyName` with a list of `names`.
  2: (doc) => ({ ...doc, version: 3, graph: mapPeople(doc.graph, namesFromV2) }),
  // v4 added life events to the graph and an optional `location` and `locationCountry`
  // to people. Dates gained
  // qualifiers, which old plain dates already satisfy.
  3: (doc) => ({
    ...doc,
    version: 4,
    graph: isRecord(doc.graph) ? { events: [], ...doc.graph } : doc.graph,
  }),
}

function mapPeople(graph: unknown, update: (person: Record<string, unknown>) => unknown): unknown {
  if (!isRecord(graph) || !isRecord(graph.people)) return graph
  const people = Object.fromEntries(
    Object.entries(graph.people).map(([id, person]) => [id, isRecord(person) ? update(person) : person]),
  )
  return { ...graph, people }
}

/** Leaves anything unexpected for validation to report. */
function namesFromV2(person: Record<string, unknown>): Record<string, unknown> {
  const { givenName, familyName, ...rest } = person
  if (typeof givenName !== 'string') return person
  if (familyName !== undefined && typeof familyName !== 'string') return person
  return { ...rest, names: [familyName ? { given: givenName, surnames: [familyName] } : { given: givenName }] }
}

/**
 * Checks that data loaded from storage or a backup file is a valid family
 * tree and returns a clean copy of it, keeping only known fields.
 */
export function parseTreeDocument(data: unknown): FamilyGraph {
  return parseGraph(migrate(data).graph)
}

export interface Backup {
  graph: FamilyGraph
  photos: Map<string, Blob>
}

/** Like `parseTreeDocument`, plus the photos a backup file carries. */
export function parseBackup(data: unknown): Backup {
  const doc = migrate(data)
  return { graph: parseGraph(doc.graph), photos: parsePhotos(doc.photos) }
}

function migrate(data: unknown): Record<string, unknown> {
  if (!isRecord(data) || data.format !== TREE_FORMAT) {
    throw new TreeFileError(t('file.notKingraph'))
  }
  const { version } = data
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new TreeFileError(t('file.badVersion'))
  }
  if (version > TREE_VERSION) {
    throw new TreeFileError(t('file.newer'))
  }

  let doc = data
  for (let v = version; v < TREE_VERSION; v++) doc = MIGRATIONS[v](doc)
  return doc
}

/** Photos are small JPEGs made by `preparePhoto`; anything far larger isn't ours. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const PHOTO_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/

function parsePhotos(raw: unknown): Map<string, Blob> {
  const photos = new Map<string, Blob>()
  if (raw === undefined) return photos
  if (!isRecord(raw)) throw damaged(t('d.photosMalformed'))
  for (const [id, dataUrl] of Object.entries(raw)) {
    const match = typeof dataUrl === 'string' ? PHOTO_DATA_URL.exec(dataUrl) : null
    if (!match) throw damaged(t('d.photoUnsupported'))
    const [, type, base64] = match
    if ((base64.length * 3) / 4 > MAX_PHOTO_BYTES) throw damaged(t('d.photoLarge'))
    photos.set(id, new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type }))
  }
  return photos
}

// --- Validation ---------------------------------------------------------------

const GENDERS: readonly Gender[] = ['female', 'male', 'other']
const NAME_TYPES: readonly NameType[] = ['birth', 'married', 'nickname', 'alias', 'religious', 'other']
const NAME_SCRIPTS: readonly NameScript[] = ['hanja', 'romanized', 'other']
const PARENT_KINDS: readonly ParentKind[] = ['biological', 'adoptive', 'foster']
const STATUSES: readonly PartnershipStatus[] = [
  'married',
  'partnered',
  'separated',
  'divorced',
  'widowed',
]

function damaged(detail: string): TreeFileError {
  return new TreeFileError(t('file.damaged', { detail }))
}

function parseGraph(raw: unknown): FamilyGraph {
  if (!isRecord(raw) || !isRecord(raw.people)) throw damaged(t('d.noPeople'))

  const people: Record<PersonId, Person> = {}
  for (const [key, value] of Object.entries(raw.people)) {
    people[key] = parsePerson(key, value)
  }

  const { managerId } = raw
  if (typeof managerId !== 'string' || !people[managerId] || people[managerId].isPlaceholder) {
    throw damaged(t('d.noManager'))
  }

  const exists = (id: unknown): id is PersonId => typeof id === 'string' && id in people
  const parentLinks = parseList(raw.parentLinks, t('d.parentLinks'), (link): ParentLink => {
    if (!isRecord(link) || !exists(link.parentId) || !exists(link.childId)) {
      throw damaged(t('d.linkMissing'))
    }
    if (link.parentId === link.childId) throw damaged(t('d.ownParent'))
    return {
      parentId: link.parentId,
      childId: link.childId,
      kind: oneOf(link.kind, PARENT_KINDS, t('d.kind')),
    }
  })
  const partnerships = parseList(raw.partnerships, t('d.partnerships'), (p): Partnership => {
    if (!isRecord(p) || typeof p.id !== 'string' || !Array.isArray(p.partnerIds)) {
      throw damaged(t('d.partnershipMalformed'))
    }
    const [a, b] = p.partnerIds
    if (p.partnerIds.length !== 2 || !exists(a) || !exists(b) || a === b) {
      throw damaged(t('d.partnershipMissing'))
    }
    return {
      id: p.id,
      partnerIds: [a, b],
      status: oneOf(p.status, STATUSES, t('d.status')),
      startDate: optionalDate(p.startDate),
      endDate: optionalDate(p.endDate),
    }
  })

  const events = parseList(raw.events, t('d.events'), (e) => parseEvent(e, exists))

  checkParentLinks(parentLinks)
  checkPartnerships(partnerships)
  return { managerId, people, parentLinks, partnerships, events }
}

function parseEvent(raw: unknown, exists: (id: unknown) => id is PersonId): LifeEvent {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !exists(raw.personId)) {
    throw damaged(t('d.event'))
  }
  const text = (value: unknown): string | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw damaged(t('d.event'))
    return value
  }
  const type = oneOf<EventType>(raw.type, EVENT_TYPES, t('d.event'))
  if (raw.kind !== undefined && !isKindOf(type, raw.kind)) throw damaged(t('d.event'))
  return {
    id: raw.id,
    personId: raw.personId,
    type,
    kind: raw.kind,
    label: text(raw.label),
    date: optionalDate(raw.date),
    place: text(raw.place),
    description: text(raw.description),
  }
}

function parsePerson(key: string, value: unknown): Person {
  if (!isRecord(value) || value.id !== key || !Array.isArray(value.names) || value.names.length === 0) {
    throw damaged(t('d.personMissing'))
  }
  const [first, ...others] = value.names.map(parseName)
  if (!first.given.trim()) throw damaged(t('d.personMissing'))
  const name = first.given
  for (const flag of ['isPlaceholder', 'deceased'] as const) {
    if (value[flag] !== undefined && typeof value[flag] !== 'boolean') {
      throw damaged(t('d.flag', { name, flag }))
    }
  }
  if (value.photoId !== undefined && typeof value.photoId !== 'string') {
    throw damaged(t('d.photoRef', { name }))
  }
  if (value.location !== undefined && typeof value.location !== 'string') {
    throw damaged(t('d.location', { name }))
  }
  if (
    value.locationCountry !== undefined &&
    (typeof value.locationCountry !== 'string' || !/^[a-z]{2}$/.test(value.locationCountry))
  ) {
    throw damaged(t('d.location', { name }))
  }
  return {
    id: key,
    names: [first, ...others],
    gender:
      value.gender === undefined ? undefined : oneOf(value.gender, GENDERS, t('d.gender', { name })),
    birthDate: optionalDate(value.birthDate),
    deathDate: optionalDate(value.deathDate),
    deceased: value.deceased === true || undefined,
    location: value.location || undefined,
    locationCountry: value.location ? value.locationCountry : undefined,
    photoId: value.photoId,
    isPlaceholder: value.isPlaceholder === true || undefined,
  }
}

function parseName(raw: unknown): PersonName {
  if (!isRecord(raw)) throw damaged(t('d.name'))
  return {
    ...parseNameParts(raw),
    type: optionalOneOf(raw.type, NAME_TYPES),
    from: optionalDate(raw.from),
    to: optionalDate(raw.to),
    forms: raw.forms === undefined ? undefined : parseForms(raw.forms),
  }
}

function parseForms(raw: unknown): NameForm[] {
  if (!Array.isArray(raw)) throw damaged(t('d.name'))
  return raw.map((form) => {
    if (!isRecord(form)) throw damaged(t('d.name'))
    return { ...parseNameParts(form), script: oneOf(form.script, NAME_SCRIPTS, t('d.name')) }
  })
}

function parseNameParts(raw: Record<string, unknown>) {
  const { given, surnames, patronymic } = raw
  const isText = (v: unknown): v is string => typeof v === 'string'
  if (
    !isText(given) ||
    (surnames !== undefined && !(Array.isArray(surnames) && surnames.every(isText))) ||
    (patronymic !== undefined && !isText(patronymic))
  ) {
    throw damaged(t('d.name'))
  }
  return { given, surnames, patronymic }
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return value === undefined ? undefined : oneOf(value, allowed, t('d.name'))
}

function checkParentLinks(links: ParentLink[]) {
  const seen = new Set<string>()
  const biological = new Map<PersonId, number>()
  for (const { parentId, childId, kind } of links) {
    const key = `${parentId}>${childId}`
    if (seen.has(key)) throw damaged(t('d.linkTwice'))
    seen.add(key)
    if (kind === 'biological') {
      const count = (biological.get(childId) ?? 0) + 1
      if (count > 2) throw damaged(t('d.threeParents'))
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
    if (visiting.has(id)) throw damaged(t('d.ancestorLoop'))
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
    if (ids.has(id) || pairs.has(pair)) throw damaged(t('d.partnershipTwice'))
    ids.add(id)
    pairs.add(pair)
  }
}

function parseList<T>(raw: unknown, what: string, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(raw)) throw damaged(t('d.listMissing', { what }))
  return raw.map(parse)
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (!allowed.includes(value as T)) throw damaged(message)
  return value as T
}

function optionalDate(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !isFuzzyDate(value)) throw damaged(t('d.date'))
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
