import { t } from '../i18n'
import {
  eventsOf,
  sortEvents,
  type EventKind,
  type EventType,
  type FamilyGraph,
  type LifeEvent,
  type NameForm,
  type NameParts,
  type NameType,
  type ParentKind,
  type ParentLink,
  type Partnership,
  type Person,
  type PersonId,
  type PersonName,
} from '../model'
import { toGedcomDate } from './dates'

/** Names of the custom tags KinGraph writes, so a round trip loses nothing. */
export const ROOT_TAG = '_ROOT'
export const PLACEHOLDER_TAG = '_PLACEHOLDER'
export const STATUS_TAG = '_STATUS'
export const PATRONYMIC_TAG = '_PATR'
export const FROM_TAG = '_FROM'
export const TO_TAG = '_TO'
export const START_TAG = '_START'
export const END_TAG = '_END'
/** Marks the RESI that is where someone lives now, rather than a past residence. */
export const CURRENT_TAG = '_CURRENT'
/** On a family whose parents aren't partners, so a round trip doesn't make them so. */
export const COPARENTS_TAG = '_COPARENTS'

export const NAME_TYPE_OUT: Partial<Record<NameType, string>> = {
  birth: 'birth',
  married: 'married',
  alias: 'aka',
  nickname: 'nickname',
  religious: 'religious',
}

export const PEDI_OUT: Record<ParentKind, string> = {
  biological: 'birth',
  adoptive: 'adopted',
  foster: 'foster',
}

/** A family record: the parents, if any, with their children and how each is related. */
interface Family {
  parents: PersonId[]
  partnership?: Partnership
  children: { id: PersonId; kind: ParentKind }[]
}

/** Writes the tree as a GEDCOM 5.5.1 file (UTF-8, lineage-linked). */
export function toGedcom(graph: FamilyGraph, now = new Date()): string {
  const out: string[] = []
  const line = (level: number, tag: string, value?: string, xref?: string) => {
    const text = value && !POINTER.test(value) ? value.replace(/@/g, '@@') : value
    out.push([level, xref, tag, text].filter((p) => p !== undefined && p !== '').join(' '))
  }

  const ids = Object.keys(graph.people)
  const personRef = new Map(ids.map((id, i) => [id, `@I${i + 1}@`]))
  const families = buildFamilies(graph)
  const familyRef = new Map(families.map((f, i) => [f, `@F${i + 1}@`]))

  line(0, 'HEAD')
  line(1, 'SOUR', 'KinGraph')
  line(2, 'NAME', 'KinGraph')
  line(1, 'DATE', toGedcomDate(isoDay(now)).toUpperCase())
  line(1, 'SUBM', '@U1@')
  line(1, 'GEDC')
  line(2, 'VERS', '5.5.1')
  line(2, 'FORM', 'LINEAGE-LINKED')
  line(1, 'CHAR', 'UTF-8')
  line(1, ROOT_TAG, personRef.get(graph.managerId))
  line(0, 'SUBM', undefined, '@U1@')
  line(1, 'NAME', 'KinGraph')

  const childOf = new Map<PersonId, { family: Family; kind: ParentKind }[]>()
  const spouseIn = new Map<PersonId, Family[]>()
  for (const family of families) {
    for (const { id, kind } of family.children) {
      childOf.set(id, [...(childOf.get(id) ?? []), { family, kind }])
    }
    for (const id of family.parents) spouseIn.set(id, [...(spouseIn.get(id) ?? []), family])
  }

  for (const id of ids) {
    const person = graph.people[id]
    line(0, 'INDI', undefined, personRef.get(id))
    if (person.isPlaceholder) {
      line(1, 'NAME', 'Unknown //')
      line(1, PLACEHOLDER_TAG, 'Y')
    } else {
      person.names.forEach((name) => writeName(line, name))
    }
    if (person.gender) line(1, 'SEX', { female: 'F', male: 'M', other: 'X' }[person.gender])
    writeEvent(line, 'BIRT', person.birthDate)
    if (person.deathDate) writeEvent(line, 'DEAT', person.deathDate)
    else if (person.deceased) line(1, 'DEAT', 'Y')
    for (const event of sortEvents(eventsOf(graph, id))) writeLifeEvent(line, event)
    if (person.location) {
      line(1, 'RESI')
      line(2, 'PLAC', clean(person.location))
      line(2, CURRENT_TAG, 'Y')
    }
    for (const { family, kind } of childOf.get(id) ?? []) {
      line(1, 'FAMC', familyRef.get(family))
      line(2, 'PEDI', PEDI_OUT[kind])
    }
    for (const family of spouseIn.get(id) ?? []) line(1, 'FAMS', familyRef.get(family))
  }

  for (const family of families) {
    line(0, 'FAM', undefined, familyRef.get(family))
    const [first, second] = family.parents
    // HUSB and WIFE follow gender where known; otherwise the order they were stored in.
    const [husband, wife] = [first, second].sort(
      (a, b) => rank(graph.people[a]) - rank(graph.people[b]),
    )
    if (husband) line(1, 'HUSB', personRef.get(husband))
    if (wife) line(1, 'WIFE', personRef.get(wife))
    for (const { id } of family.children) line(1, 'CHIL', personRef.get(id))
    if (family.partnership) writePartnership(line, family.partnership)
    else if (family.parents.length === 2) line(1, COPARENTS_TAG, 'Y')
  }

  line(0, 'TRLR')
  return out.join('\r\n') + '\r\n'
}

const POINTER = /^@[^@\s]+@$/

const rank = (person: Person | undefined) => (person?.gender === 'female' ? 1 : 0)

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

type Line = (level: number, tag: string, value?: string, xref?: string) => void

function writeEvent(line: Line, tag: string, date: string | undefined, level = 1) {
  if (!date) return
  line(level, tag)
  line(level + 1, 'DATE', toGedcomDate(date))
}

/**
 * The standard GEDCOM tags life events are written with, and what each means
 * when read. A tag with a `kind` says exactly what happened (CHR is a child
 * baptism); one without covers its whole type (EDUC is any education).
 */
export const EVENT_TAGS: readonly { tag: string; type: EventType; kind?: EventKind }[] = [
  { tag: 'BAPM', type: 'religion', kind: 'baptism' },
  { tag: 'CHR', type: 'religion', kind: 'childBaptism' },
  { tag: 'CONF', type: 'religion', kind: 'confirmation' },
  { tag: 'FCOM', type: 'religion', kind: 'firstCommunion' },
  { tag: 'BARM', type: 'religion', kind: 'barMitzvah' },
  { tag: 'BASM', type: 'religion', kind: 'batMitzvah' },
  { tag: 'GRAD', type: 'education', kind: 'schoolGraduation' },
  { tag: 'EDUC', type: 'education' },
  { tag: 'RETI', type: 'work', kind: 'retirement' },
  { tag: 'OCCU', type: 'work' },
  { tag: 'RESI', type: 'residence' },
  { tag: 'EMIG', type: 'migration', kind: 'emigrated' },
  { tag: 'IMMI', type: 'migration', kind: 'immigrated' },
  { tag: 'NATU', type: 'migration', kind: 'naturalized' },
  { tag: 'BURI', type: 'funeral', kind: 'burial' },
  { tag: 'CREM', type: 'funeral', kind: 'cremation' },
]

/** Kinds without a tag of their own that are still best written as a related one. */
const KIND_FALLBACK_TAGS: Partial<Record<EventKind, string>> = { adultBaptism: 'BAPM' }

/** Keeps the exact kind (`_KIND`) or type (`_CATEGORY`) where the tag alone doesn't say it. */
export const KIND_TAG = '_KIND'
export const CATEGORY_TAG = '_CATEGORY'

/** Events whose line value is what the event was (the occupation) rather than a Y. */
export const EVENT_VALUE_TAGS = new Set(['OCCU', 'EDUC'])

/** The tag an event is written with, and whether its kind needs spelling out with `_KIND`. */
function tagFor(event: LifeEvent): { tag: string; exact: boolean } {
  const { type, kind } = event
  const exact = EVENT_TAGS.find((e) => e.type === type && e.kind === kind && kind)
  if (exact) return { tag: exact.tag, exact: true }
  const fallback = kind && KIND_FALLBACK_TAGS[kind]
  if (fallback) return { tag: fallback, exact: false }
  const general = EVENT_TAGS.find((e) => e.type === type && !e.kind)
  return { tag: general?.tag ?? 'EVEN', exact: !kind }
}

function writeLifeEvent(line: Line, event: LifeEvent) {
  const { tag, exact } = tagFor(event)
  const description = event.description ? clean(event.description) : ''
  const valueLine = EVENT_VALUE_TAGS.has(tag)
  line(1, tag, valueLine ? description || undefined : undefined)
  // A readable name for other programs: the event's own, its kind's, or for EVEN its type's.
  const name = event.label ?? (event.kind && t(`eventKind.${event.kind}`))
  if (name && !(exact && !event.label)) line(2, 'TYPE', clean(name))
  else if (tag === 'EVEN') line(2, 'TYPE', t(`event.${event.type}`))
  if (event.kind && !exact) line(2, KIND_TAG, event.kind)
  if (tag === 'EVEN' && event.type !== 'other' && !event.kind) line(2, CATEGORY_TAG, event.type)
  if (event.date) line(2, 'DATE', toGedcomDate(event.date))
  if (event.place) line(2, 'PLAC', clean(event.place))
  if (!valueLine && description) line(2, 'NOTE', description)
}

function clean(text: string): string {
  return text.replace(/[/\r\n]+/g, ' ').trim()
}

function writeName(line: Line, name: PersonName) {
  writeNameParts(line, 'NAME', name)
  const type = name.type && NAME_TYPE_OUT[name.type]
  // TYPE belongs inside the NAME structure, so it follows the lines written above.
  if (type) line(2, 'TYPE', type)
  if (name.from) line(2, FROM_TAG, toGedcomDate(name.from))
  if (name.to) line(2, TO_TAG, toGedcomDate(name.to))
  for (const form of name.forms ?? []) writeForm(line, form)
}

function writeNameParts(line: Line, tag: string, parts: NameParts) {
  const surnames = (parts.surnames ?? []).map(clean).filter(Boolean)
  const patronymic = parts.patronymic ? clean(parts.patronymic) : ''
  const family = [...surnames, patronymic].filter(Boolean).join(' ')
  line(tag === 'NAME' ? 1 : 2, tag, `${clean(parts.given)} /${family}/`)
  const sub = tag === 'NAME' ? 2 : 3
  line(sub, 'GIVN', clean(parts.given))
  if (surnames.length) line(sub, 'SURN', surnames.join(', '))
  if (patronymic) line(sub, PATRONYMIC_TAG, patronymic)
}

function writeForm(line: Line, form: NameForm) {
  // GEDCOM has "romanized" and "phonetic" variants of a name; other scripts go in the latter.
  const tag = form.script === 'romanized' ? 'ROMN' : 'FONE'
  writeNameParts(line, tag, form)
  if (tag === 'FONE') line(3, 'TYPE', form.script)
}

const STATUS_OUT: Record<Partnership['status'], string> = {
  married: 'MARRIED',
  partnered: 'PARTNERED',
  separated: 'SEPARATED',
  divorced: 'DIVORCED',
  widowed: 'WIDOWED',
}

function writePartnership(line: Line, p: Partnership) {
  const married = p.status !== 'partnered'
  if (married) {
    writeEvent(line, 'MARR', p.startDate)
    if (!p.startDate) line(1, 'MARR', 'Y')
  } else if (p.startDate) {
    writeEvent(line, START_TAG, p.startDate)
  }
  if (p.status === 'divorced') {
    if (p.endDate) writeEvent(line, 'DIV', p.endDate)
    else line(1, 'DIV', 'Y')
  } else if (p.endDate) {
    writeEvent(line, END_TAG, p.endDate)
  }
  line(1, STATUS_TAG, STATUS_OUT[p.status])
}

/**
 * Groups people into families: one for each partnership, plus one for every
 * set of parents who aren't partners or have a child alone. A child whose
 * parents are related to them in different ways is listed under each parent
 * separately, since GEDCOM records how a child is related per family.
 */
function buildFamilies(graph: FamilyGraph): Family[] {
  const families = new Map<string, Family>()
  const keyOf = (parents: PersonId[]) => [...parents].sort().join('+')

  for (const partnership of graph.partnerships) {
    const parents = [...partnership.partnerIds]
    families.set(keyOf(parents), { parents, partnership, children: [] })
  }

  const linksByChild = new Map<PersonId, ParentLink[]>()
  for (const link of graph.parentLinks) {
    linksByChild.set(link.childId, [...(linksByChild.get(link.childId) ?? []), link])
  }

  const place = (parents: PersonId[], id: PersonId, kind: ParentKind) => {
    const key = keyOf(parents)
    const family = families.get(key) ?? { parents, children: [] }
    families.set(key, family)
    family.children.push({ id, kind })
  }

  for (const [childId, links] of linksByChild) {
    const sameKind = links.every((l) => l.kind === links[0].kind)
    if (sameKind && links.length <= 2) {
      place(links.map((l) => l.parentId), childId, links[0].kind)
    } else {
      for (const link of links) place([link.parentId], childId, link.kind)
    }
  }
  return [...families.values()]
}
