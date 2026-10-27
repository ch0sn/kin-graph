import { t } from '../i18n'
import {
  PARENT_KINDS,
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
import { applyLivingPolicy, type LivingPolicy } from './privacy'

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

/** GEDCOM 7 has no name type for these, so they are written as OTHER with a PHRASE. */
const NAME_TYPES_7: Partial<Record<NameType, string>> = {
  birth: 'BIRTH',
  married: 'MARRIED',
  alias: 'AKA',
}

/** The language tag GEDCOM 7 names a written form of a name with (`TRAN` + `LANG`). */
export const SCRIPT_LANG: Record<NameForm['script'], string> = {
  hanja: 'ko-Hani',
  romanized: 'und-Latn',
  other: 'und',
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

export type GedcomVersion = '5.5.1' | '7.0'
export const GEDCOM_VERSIONS: readonly GedcomVersion[] = ['5.5.1', '7.0']

export interface GedcomOptions {
  /** 5.5.1 is the one most programs read; 7.0 is the current standard. */
  version?: GedcomVersion
  /** What to do with people who may still be alive; see `applyLivingPolicy`. */
  living?: LivingPolicy
  now?: Date
  /**
   * Where each photo is, by photo id, as a path next to the file
   * ("photos/1.jpg"). People whose photo isn't listed are written without one.
   */
  photos?: ReadonlyMap<string, string>
}

/** What the person picks when exporting. */
export type GedcomChoices = Required<Pick<GedcomOptions, 'version' | 'living'>> & {
  /** Save a .zip with the photos next to the .ged, rather than the .ged alone. */
  photos: boolean
}
export const DEFAULT_GEDCOM_CHOICES: GedcomChoices = { version: '5.5.1', living: 'include', photos: false }

/**
 * Where the custom tags are described, which GEDCOM 7 asks for in the header
 * (`SCHMA`) so other programs can tell them apart from anyone else's.
 */
export const SCHEMA_BASE = 'https://github.com/ch0sn/kin-graph/blob/main/docs/gedcom.md#'

/** Writes the tree as a lineage-linked GEDCOM file in UTF-8. */
export function toGedcom(source: FamilyGraph, options: GedcomOptions = {}): string {
  const { version = '5.5.1', living = 'include', now = new Date(), photos = new Map<string, string>() } = options
  const v7 = version === '7.0'
  const graph = applyLivingPolicy(source, living, now)
  const out: string[] = []
  const line = (level: number, tag: string, value?: string, xref?: string) => {
    const prefix = [level, xref, tag].filter((p) => p !== undefined && p !== '').join(' ')
    if (value === undefined || value === '') {
      out.push(prefix)
      return
    }
    // 5.5.1 doubles every @ in text; 7.0 only one that starts the value.
    const text = POINTER.test(value) ? value : v7 ? value.replace(/^@/, '@@') : value.replace(/@/g, '@@')
    const lines = text.split(/\r\n|\r|\n/)

    const emitPieces = (prefix: string, content: string, nextPrefix: string) => {
      // GEDCOM 7 has no line length limit, and no CONC to split lines with.
      if (v7) {
        out.push(content ? `${prefix} ${content}` : prefix)
        return
      }
      const maxLen = 255 - prefix.length - 1
      const { chunk, rest } = splitChunk(content, maxLen)
      out.push(chunk ? `${prefix} ${chunk}` : prefix)
      let remaining = rest
      while (remaining.length > 0) {
        const nextMax = 255 - nextPrefix.length - 1
        const next = splitChunk(remaining, nextMax)
        out.push(next.chunk ? `${nextPrefix} ${next.chunk}` : nextPrefix)
        remaining = next.rest
      }
    }

    emitPieces(prefix, lines[0], `${level + 1} CONC`)
    for (let i = 1; i < lines.length; i++) {
      emitPieces(`${level + 1} CONT`, lines[i], `${level + 1} CONC`)
    }
  }

  const ids = Object.keys(graph.people)
  const personRef = new Map(ids.map((id, i) => [id, `@I${i + 1}@`]))
  const families = buildFamilies(graph)
  const familyRef = new Map(families.map((f, i) => [f, `@F${i + 1}@`]))
  const photoIds = [...new Set(ids.flatMap((id) => graph.people[id].photoId ?? []))].filter((p) => photos.has(p))
  const photoRef = new Map(photoIds.map((photoId, i) => [photoId, `@O${i + 1}@`]))

  line(0, 'HEAD')
  line(1, 'SOUR', 'KinGraph')
  line(2, 'NAME', 'KinGraph')
  line(1, 'DATE', toGedcomDate(isoDay(now)).toUpperCase())
  line(1, 'SUBM', '@U1@')
  line(1, 'GEDC')
  line(2, 'VERS', version)
  if (v7) {
    line(1, 'SCHMA')
    for (const tag of CUSTOM_TAGS) line(2, 'TAG', `${tag} ${SCHEMA_BASE}${tag.toLowerCase()}`)
  } else {
    line(2, 'FORM', 'LINEAGE-LINKED')
    line(1, 'CHAR', 'UTF-8')
  }
  // The manager may have been left out as a living person.
  const root = personRef.get(graph.managerId)
  if (root) line(1, ROOT_TAG, root)
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
      person.names.forEach((name) => writeName(line, name, v7))
    }
    if (person.gender) line(1, 'SEX', { female: 'F', male: 'M', other: 'X' }[person.gender])
    writeEvent(line, 'BIRT', person.birthDate, person.birthPlace)
    if (person.deathDate || person.deathPlace) writeEvent(line, 'DEAT', person.deathDate, person.deathPlace)
    else if (person.deceased) line(1, 'DEAT', 'Y')
    for (const event of sortEvents(eventsOf(graph, id))) writeLifeEvent(line, event, v7)
    if (person.location) {
      // In GEDCOM 7 a residence says where in its own line, as well as in PLAC.
      line(1, 'RESI', v7 ? clean(person.location) : undefined)
      line(2, 'PLAC', clean(person.location))
      line(2, CURRENT_TAG, 'Y')
    }
    if (person.notes) line(1, 'NOTE', person.notes)
    if (person.photoId && photoRef.has(person.photoId)) line(1, 'OBJE', photoRef.get(person.photoId))
    for (const { family, kind } of childOf.get(id) ?? []) {
      line(1, 'FAMC', familyRef.get(family))
      line(2, 'PEDI', v7 ? PEDI_OUT[kind].toUpperCase() : PEDI_OUT[kind])
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

  for (const [photoId, ref] of photoRef) {
    const path = photos.get(photoId)!
    line(0, 'OBJE', undefined, ref)
    line(1, 'FILE', path)
    line(2, 'FORM', mediaFormat(path, v7))
  }

  line(0, 'TRLR')
  return out.join('\r\n') + '\r\n'
}

const POINTER = /^@[^@\s]+@$/

/** GEDCOM 5.5.1 names a file's format by its extension ("jpg"); 7.0 by its media type. */
function mediaFormat(path: string, v7: boolean): string {
  const extension = /\.(\w+)$/.exec(path)?.[1].toLowerCase() ?? 'jpg'
  if (!v7) return extension === 'jpeg' ? 'jpg' : extension
  return `image/${extension === 'jpg' ? 'jpeg' : extension}`
}

const rank = (person: Person | undefined) => (person?.gender === 'female' ? 1 : 0)

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

type Line = (level: number, tag: string, value?: string, xref?: string) => void

function writeEvent(line: Line, tag: string, date: string | undefined, place?: string) {
  if (!date && !place) return
  line(1, tag)
  if (date) line(2, 'DATE', toGedcomDate(date))
  if (place) line(2, 'PLAC', clean(place))
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

/** Every custom tag KinGraph writes, which GEDCOM 7 files list in the header. */
const CUSTOM_TAGS = [
  ROOT_TAG,
  PLACEHOLDER_TAG,
  STATUS_TAG,
  PATRONYMIC_TAG,
  FROM_TAG,
  TO_TAG,
  START_TAG,
  END_TAG,
  CURRENT_TAG,
  COPARENTS_TAG,
  KIND_TAG,
  CATEGORY_TAG,
]

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

function writeLifeEvent(line: Line, event: LifeEvent, v7: boolean) {
  const { tag, exact } = tagFor(event)
  const description = event.description ? clean(event.description) : ''
  const valueLine = EVENT_VALUE_TAGS.has(tag)
  const residence = v7 && tag === 'RESI' && event.place ? clean(event.place) : undefined
  line(1, tag, valueLine ? description || undefined : residence)
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

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function splitChunk(str: string, maxLen: number): { chunk: string; rest: string } {
  if (str.length <= maxLen) {
    return { chunk: str, rest: '' }
  }
  let cut = maxLen
  if (cut > 0 && isHighSurrogate(str.charCodeAt(cut - 1))) {
    cut--
  }
  while (cut > 0 && str[cut - 1] === ' ') {
    cut--
  }
  if (cut > 0 && isHighSurrogate(str.charCodeAt(cut - 1))) {
    cut--
  }
  if (cut === 0) {
    cut = Math.min(maxLen, str.length)
    if (cut > 0 && isHighSurrogate(str.charCodeAt(cut - 1))) {
      cut--
    }
  }
  return {
    chunk: str.slice(0, cut),
    rest: str.slice(cut),
  }
}

function clean(text: string): string {
  return text.replace(/\/+/g, ' ').trim()
}

function writeName(line: Line, name: PersonName, v7: boolean) {
  writeNameParts(line, 'NAME', name)
  // TYPE belongs inside the NAME structure, so it follows the lines written above.
  const type = name.type && NAME_TYPE_OUT[name.type]
  if (type && !v7) line(2, 'TYPE', type)
  if (type && v7) {
    const standard = NAME_TYPES_7[name.type!]
    line(2, 'TYPE', standard ?? 'OTHER')
    if (!standard) line(3, 'PHRASE', type)
  }
  if (name.from) line(2, FROM_TAG, toGedcomDate(name.from))
  if (name.to) line(2, TO_TAG, toGedcomDate(name.to))
  for (const form of name.forms ?? []) writeForm(line, form, v7)
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

function writeForm(line: Line, form: NameForm, v7: boolean) {
  if (v7) {
    // GEDCOM 7 writes another form of a name as a translation, tagged with its script.
    writeNameParts(line, 'TRAN', form)
    line(3, 'LANG', SCRIPT_LANG[form.script])
    return
  }
  // GEDCOM 5.5.1 has "romanized" and "phonetic" variants of a name; other scripts go in the latter.
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

  const place = (parents: PersonId[], id: PersonId, kind: ParentKind, key = keyOf(parents)) => {
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
    // A parent related in a second way, such as a birth father who also adopted, is
    // listed again in a family of its own for that kind, since a family has one per child.
    for (const kind of PARENT_KINDS) {
      const parents = links.filter((l) => l.alsoKinds?.includes(kind)).map((l) => l.parentId)
      if (parents.length === 0) continue
      const groups = parents.length <= 2 ? [parents] : parents.map((p) => [p])
      for (const group of groups) place(group, childId, kind, `${keyOf(group)}#${kind}`)
    }
  }
  return [...families.values()]
}
