import { t } from '../i18n'
import {
  type FamilyGraph,
  type FuzzyDate,
  type Gender,
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
import { fromGedcomDate } from './dates'
import {
  COPARENTS_TAG,
  END_TAG,
  FROM_TAG,
  PATRONYMIC_TAG,
  PLACEHOLDER_TAG,
  ROOT_TAG,
  START_TAG,
  STATUS_TAG,
  TO_TAG,
} from './export'
import { child, childrenOf, decodeGedcom, parseRecords, type GedcomNode } from './records'

/** Thrown when a file isn't GEDCOM at all. */
export class GedcomError extends Error {
  override name = 'GedcomError'
}

/** What couldn't be carried over, so the person can see what they're not getting. */
export interface ImportReport {
  families: number
  /** Tags that KinGraph has no place for, with how many times each appeared: OCCU, NOTE, SOUR… */
  unsupported: Record<string, number>
  /** Dates with a qualifier ("about 1900", "between 1900 and 1910") kept as the plain date. */
  approximateDates: number
  /** Dates that couldn't be read at all, such as phrases or other calendars. */
  droppedDates: number
  /** Parent links left out because they would give someone a third birth parent or loop. */
  skippedLinks: number
  /** Lines that weren't valid GEDCOM. */
  malformedLines: number
  /** The file wasn't UTF-8, so accents may be wrong. */
  legacyEncoding: boolean
}

export interface GedcomImport {
  /** The tree, with `managerId` set to the file's own choice or to the first person. */
  graph: FamilyGraph
  report: ImportReport
}

const SEXES: Record<string, Gender> = { M: 'male', F: 'female', X: 'other' }
const PEDIGREES: Record<string, ParentKind> = {
  birth: 'biological',
  adopted: 'adoptive',
  foster: 'foster',
}
const NAME_TYPES: Record<string, NameType> = {
  birth: 'birth',
  maiden: 'birth',
  married: 'married',
  aka: 'alias',
  nickname: 'nickname',
  religious: 'religious',
}
const STATUSES: Record<string, PartnershipStatus> = {
  MARRIED: 'married',
  PARTNERED: 'partnered',
  SEPARATED: 'separated',
  DIVORCED: 'divorced',
  WIDOWED: 'widowed',
}

/** Reads a date from an event's DATE line, counting what had to be dropped or simplified. */
type DateReader = (dateLine: GedcomNode | undefined) => FuzzyDate | undefined

const dateOf = (event: GedcomNode | undefined) => event && child(event, 'DATE')

/** Reads a GEDCOM file given as raw bytes. */
export function importGedcomFile(bytes: Uint8Array): GedcomImport {
  const { text, legacy } = decodeGedcom(bytes)
  const result = importGedcom(text)
  result.report.legacyEncoding = legacy
  return result
}

/** Reads GEDCOM text, keeping what fits a `FamilyGraph` and reporting the rest. */
export function importGedcom(text: string): GedcomImport {
  const { records, malformedLines } = parseRecords(text)
  const individuals = records.filter((r) => r.tag === 'INDI' && r.xref)
  if (records[0]?.tag !== 'HEAD' || individuals.length === 0) {
    throw new GedcomError(t('gedcom.notGedcom'))
  }

  const report: ImportReport = {
    families: 0,
    unsupported: {},
    approximateDates: 0,
    droppedDates: 0,
    skippedLinks: 0,
    malformedLines,
    legacyEncoding: false,
  }
  const unsupported = (tag: string) => {
    report.unsupported[tag] = (report.unsupported[tag] ?? 0) + 1
  }
  const readDate: DateReader = (node) => {
    const value = node?.value
    if (!value) return undefined
    const parsed = fromGedcomDate(value)
    if (parsed.kind === 'unsupported') {
      report.droppedDates++
      return undefined
    }
    if (parsed.kind === 'approximate') report.approximateDates++
    return parsed.date
  }

  // Records other than people and families (sources, notes, repositories) have no home.
  for (const record of records) {
    if (!['HEAD', 'INDI', 'FAM', 'TRLR', 'SUBM'].includes(record.tag)) unsupported(record.tag)
  }

  const idOf = new Map<string, PersonId>()
  const people: Record<PersonId, Person> = {}
  for (const record of individuals) {
    const person = readPerson(record, readDate, unsupported)
    idOf.set(record.xref!, person.id)
    people[person.id] = person
  }

  const parentLinks: ParentLink[] = []
  const partnerships: Partnership[] = []
  const pedigree = pedigrees(individuals, idOf)
  const parentsOfChild = new Map<PersonId, PersonId[]>()

  const addLink = (parentId: PersonId, childId: PersonId, kind: ParentKind) => {
    const parents = parentsOfChild.get(childId) ?? []
    const biological = parentLinks.filter((l) => l.childId === childId && l.kind === 'biological')
    if (
      parentId === childId ||
      parents.includes(parentId) ||
      (kind === 'biological' && biological.length >= 2) ||
      isAncestorIn(parentLinks, childId, parentId)
    ) {
      report.skippedLinks++
      return
    }
    parentLinks.push({ parentId, childId, kind })
    parentsOfChild.set(childId, [...parents, parentId])
  }

  for (const family of records.filter((r) => r.tag === 'FAM')) {
    report.families++
    const ref = (tag: string) => {
      const target = child(family, tag)?.value
      return target ? idOf.get(target) : undefined
    }
    const spouses = [ref('HUSB'), ref('WIFE')].filter((id): id is PersonId => id !== undefined)
    const children = childrenOf(family, 'CHIL').flatMap((c) => idOf.get(c.value) ?? [])

    for (const childId of children) {
      const kind = pedigree.get(`${family.xref}>${childId}`) ?? 'biological'
      for (const parentId of spouses) addLink(parentId, childId, kind)
    }

    if (spouses.length === 2 && spouses[0] !== spouses[1] && !child(family, COPARENTS_TAG)) {
      const [a, b] = spouses
      const exists = partnerships.some(
        (p) => p.partnerIds.includes(a) && p.partnerIds.includes(b),
      )
      if (!exists) partnerships.push(readPartnership([a, b], family, readDate))
    }
    for (const c of family.children) {
      if (!FAMILY_TAGS.has(c.tag)) unsupported(c.tag)
    }
  }

  const managerId = chooseManager(records, idOf, people)
  return {
    graph: { managerId, people, parentLinks, partnerships },
    report,
  }
}

const FAMILY_TAGS = new Set([
  'HUSB',
  'WIFE',
  'CHIL',
  'MARR',
  'DIV',
  STATUS_TAG,
  START_TAG,
  END_TAG,
  COPARENTS_TAG,
])

const PERSON_TAGS = new Set([
  'NAME',
  'SEX',
  'BIRT',
  'DEAT',
  'FAMC',
  'FAMS',
  PLACEHOLDER_TAG,
])

function chooseManager(
  records: GedcomNode[],
  idOf: Map<string, PersonId>,
  people: Record<PersonId, Person>,
): PersonId {
  const root = records.find((r) => r.tag === 'HEAD')?.children.find((c) => c.tag === ROOT_TAG)
  const fromFile = root && idOf.get(root.value)
  if (fromFile && !people[fromFile].isPlaceholder) return fromFile
  const first = Object.values(people).find((p) => !p.isPlaceholder) ?? Object.values(people)[0]
  // A tree must be rooted in a real person, so a file of only placeholders is unusable.
  if (first.isPlaceholder) throw new GedcomError(t('gedcom.notGedcom'))
  return first.id
}

/** Where each child's PEDI sits: under the INDI's FAMC line, keyed by family and child. */
function pedigrees(individuals: GedcomNode[], idOf: Map<string, PersonId>) {
  const kinds = new Map<string, ParentKind>()
  for (const indi of individuals) {
    for (const famc of childrenOf(indi, 'FAMC')) {
      const pedi = child(famc, 'PEDI')?.value.toLowerCase()
      const kind = pedi && PEDIGREES[pedi]
      if (kind) kinds.set(`${famc.value}>${idOf.get(indi.xref!)}`, kind)
    }
  }
  return kinds
}

function isAncestorIn(links: ParentLink[], ancestorId: PersonId, personId: PersonId): boolean {
  // Is `ancestorId` already above `personId`? Then making it their child would loop.
  const seen = new Set<PersonId>()
  const queue = [personId]
  while (queue.length) {
    const current = queue.pop()!
    if (current === ancestorId) return true
    if (seen.has(current)) continue
    seen.add(current)
    for (const l of links) if (l.childId === current) queue.push(l.parentId)
  }
  return false
}

function readPartnership(
  partnerIds: [PersonId, PersonId],
  family: GedcomNode,
  readDate: DateReader,
): Partnership {
  const marriage = child(family, 'MARR')
  const divorce = child(family, 'DIV')
  const stated = STATUSES[child(family, STATUS_TAG)?.value.toUpperCase() ?? '']
  const status: PartnershipStatus = stated ?? (divorce ? 'divorced' : marriage ? 'married' : 'partnered')
  return {
    id: crypto.randomUUID(),
    partnerIds,
    status,
    startDate: readDate(dateOf(marriage)) ?? readDate(dateOf(child(family, START_TAG))),
    endDate: readDate(dateOf(divorce)) ?? readDate(dateOf(child(family, END_TAG))),
  }
}

function readPerson(
  record: GedcomNode,
  readDate: DateReader,
  unsupported: (tag: string) => void,
): Person {
  const names = childrenOf(record, 'NAME').flatMap((n) => readNames(n, readDate, unsupported))
  const death = child(record, 'DEAT')
  const birthDate = readDate(dateOf(child(record, 'BIRT')))
  const deathDate = readDate(dateOf(death))
  const sex = child(record, 'SEX')?.value.toUpperCase()

  for (const c of record.children) {
    if (!PERSON_TAGS.has(c.tag)) unsupported(c.tag)
  }
  for (const event of ['BIRT', 'DEAT']) {
    for (const c of child(record, event)?.children ?? []) if (c.tag !== 'DATE') unsupported(`${event}.${c.tag}`)
  }

  const person: Person = {
    id: crypto.randomUUID(),
    names: names.length > 0 ? (names as Person['names']) : [{ given: t('gedcom.unknownName') }],
    gender: sex ? SEXES[sex] : undefined,
    birthDate,
    deathDate,
    deceased: death && !deathDate ? true : undefined,
    isPlaceholder: child(record, PLACEHOLDER_TAG) ? true : undefined,
  }
  return person
}

/** A NAME line and its NICK, which becomes a second name. */
function readNames(
  node: GedcomNode,
  readDate: DateReader,
  unsupported: (tag: string) => void,
): PersonName[] {
  const parts = readParts(node)
  const name: PersonName = {
    ...parts,
    type: NAME_TYPES[child(node, 'TYPE')?.value.toLowerCase() ?? ''],
    from: readDate(child(node, FROM_TAG)),
    to: readDate(child(node, TO_TAG)),
    forms: readForms(node),
  }
  if (!name.forms?.length) delete name.forms
  for (const key of Object.keys(name) as (keyof PersonName)[]) if (name[key] === undefined) delete name[key]
  for (const c of node.children) {
    if (!NAME_TAGS.has(c.tag)) unsupported(`NAME.${c.tag}`)
  }

  const nick = child(node, 'NICK')?.value.trim()
  return [name, ...(nick ? [{ given: nick, type: 'nickname' as const }] : [])]
}

const NAME_TAGS = new Set([
  'GIVN',
  'SURN',
  'TYPE',
  'NICK',
  'ROMN',
  'FONE',
  PATRONYMIC_TAG,
  FROM_TAG,
  TO_TAG,
])

function undefinedIfEmpty(value: string | undefined) {
  return value?.trim() || undefined
}

function readForms(node: GedcomNode): NameForm[] {
  const forms: NameForm[] = []
  for (const variant of [...childrenOf(node, 'ROMN'), ...childrenOf(node, 'FONE')]) {
    const type = child(variant, 'TYPE')?.value.toLowerCase()
    const script: NameScript =
      variant.tag === 'ROMN' ? 'romanized' : type === 'hanja' ? 'hanja' : 'other'
    forms.push({ ...readParts(variant), script })
  }
  return forms
}

/**
 * The parts of a name. The GIVN, SURN and patronymic lines are used when
 * present; otherwise the `Given /Surname/` form of the NAME line is split up.
 */
function readParts(node: GedcomNode): { given: string; surnames?: string[]; patronymic?: string } {
  const [lineGiven = '', lineSurname = ''] = splitNameLine(node.value)
  let given = child(node, 'GIVN')?.value.trim() || lineGiven
  const surn = child(node, 'SURN')?.value
  const patronymic = undefinedIfEmpty(child(node, PATRONYMIC_TAG)?.value)
  let surnames = surn
    ? surn.split(',').map((s) => s.trim()).filter(Boolean)
    : patronymic
      ? undefined
      : lineSurname
        ? [lineSurname]
        : undefined
  const prefix = child(node, 'SPFX')?.value.trim()
  if (prefix && surnames?.length) surnames = [`${prefix} ${surnames[0]}`, ...surnames.slice(1)]
  if (!given && surnames?.length) {
    // The model needs a given name; a name with only a surname keeps it there.
    given = surnames.join(' ')
    surnames = undefined
  }
  return {
    given: given || t('gedcom.unknownName'),
    ...(surnames?.length && { surnames }),
    ...(patronymic && { patronymic }),
  }
}

/** "Mary Ann /Smith/ Jr" → ["Mary Ann", "Smith"]; without slashes the whole line is the given name. */
function splitNameLine(value: string): [string, string] {
  const match = /^([^/]*)\/([^/]*)\/?/.exec(value)
  if (!match) return [value.trim(), '']
  return [match[1].trim(), match[2].trim()]
}
