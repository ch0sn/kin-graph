import { t } from '../i18n'
import { compareOptionalDates } from './dates'
import { getPerson, partnershipsOf, partnerOf } from './queries'
import type {
  EventKind,
  EventType,
  FamilyGraph,
  FuzzyDate,
  LifeEvent,
  NewLifeEvent,
  PersonId,
} from './types'

export const EVENT_TYPES: readonly EventType[] = [
  'education',
  'work',
  'religion',
  'residence',
  'migration',
  'military',
  'funeral',
  'other',
]

/** The kinds of event each type offers, in the order they're listed. `other` has only its own name. */
export const EVENT_KINDS: Record<EventType, readonly EventKind[]> = {
  education: ['firstDayOfSchool', 'schoolGraduation', 'apprenticeship', 'startedUniversity', 'universityDegree'],
  work: ['firstJob', 'newJob', 'promotion', 'ownBusiness', 'retirement'],
  religion: [
    'baptism',
    'childBaptism',
    'adultBaptism',
    'confirmation',
    'firstCommunion',
    'barMitzvah',
    'batMitzvah',
  ],
  residence: ['movedIn', 'boughtHome'],
  migration: ['emigrated', 'immigrated', 'naturalized'],
  military: ['enlisted', 'deployed', 'discharged'],
  funeral: ['burial', 'cremation', 'memorial'],
  other: [],
}

export function isKindOf(type: EventType, kind: unknown): kind is EventKind {
  return EVENT_KINDS[type].includes(kind as EventKind)
}

/** The type a kind belongs to. */
export function typeOfKind(kind: EventKind): EventType {
  return EVENT_TYPES.find((type) => EVENT_KINDS[type].includes(kind))!
}

/**
 * What an event or timeline entry is called: its own name, else its kind
 * ("Child baptism"), else its type ("Religion"), in the reader's language.
 */
export function eventTitle(entry: { type: TimelineEntry['type']; kind?: EventKind; label?: string }): string {
  if (entry.label) return entry.label
  if (entry.kind) return t(`eventKind.${entry.kind}`)
  return t(`event.${entry.type}`)
}

/** Thrown when an edit to the events would be inconsistent. */
export class EventError extends Error {
  override name = 'EventError'
}

export function addEvent(graph: FamilyGraph, personId: PersonId, input: NewLifeEvent): FamilyGraph {
  getPerson(graph, personId)
  const event: LifeEvent = { ...input, id: crypto.randomUUID(), personId }
  return { ...graph, events: [...graph.events, event] }
}

export function updateEvent(
  graph: FamilyGraph,
  id: string,
  patch: Partial<NewLifeEvent>,
): FamilyGraph {
  if (!graph.events.some((e) => e.id === id)) throw new EventError(t('graph.unknownEvent', { id }))
  return { ...graph, events: graph.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

export function removeEvent(graph: FamilyGraph, id: string): FamilyGraph {
  return { ...graph, events: graph.events.filter((e) => e.id !== id) }
}

/**
 * Replaces all of a person's events with `events`, keeping the ids of those
 * that have one. For forms that edit the whole list at once.
 */
export function setEvents(
  graph: FamilyGraph,
  personId: PersonId,
  events: (NewLifeEvent & { id?: string })[],
): FamilyGraph {
  getPerson(graph, personId)
  const others = graph.events.filter((e) => e.personId !== personId)
  const mine = events.map((e): LifeEvent => ({ ...e, id: e.id ?? crypto.randomUUID(), personId }))
  return { ...graph, events: [...others, ...mine] }
}

export function eventsOf(graph: FamilyGraph, personId: PersonId): LifeEvent[] {
  return graph.events.filter((e) => e.personId === personId)
}

/** Events in date order; those without a date come last, in the order they were added. */
export function sortEvents<T extends { date?: FuzzyDate }>(events: T[]): T[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => compareOptionalDates(a.event.date, b.event.date) || a.index - b.index)
    .map(({ event }) => event)
}

/** One line of a person's timeline. */
export interface TimelineEntry {
  key: string
  type: 'birth' | 'death' | 'marriage' | 'divorce' | EventType
  kind?: EventKind
  /** An event's own name. */
  label?: string
  date?: FuzzyDate
  place?: string
  description?: string
  /** Who a marriage or divorce was with. */
  partnerId?: PersonId
  /** The stored event, for the entries that are one. Birth, death and marriages are derived. */
  event?: LifeEvent
}

/**
 * Everything known about a person's life in date order: their stored events
 * together with birth and death, and the start and end of their partnerships.
 */
export function timelineOf(graph: FamilyGraph, personId: PersonId): TimelineEntry[] {
  const person = getPerson(graph, personId)
  const entries: TimelineEntry[] = []
  if (person.birthDate) entries.push({ key: 'birth', type: 'birth', date: person.birthDate })
  if (person.deathDate) entries.push({ key: 'death', type: 'death', date: person.deathDate })
  for (const p of partnershipsOf(graph, personId)) {
    const partnerId = partnerOf(p, personId)
    if (p.status !== 'partnered' && p.startDate) {
      entries.push({ key: `${p.id}-start`, type: 'marriage', date: p.startDate, partnerId })
    }
    if (p.status === 'divorced' && p.endDate) {
      entries.push({ key: `${p.id}-end`, type: 'divorce', date: p.endDate, partnerId })
    }
  }
  for (const event of eventsOf(graph, personId)) {
    const { id, type, kind, label, date, place, description } = event
    entries.push({ key: id, type, kind, label, date, place, description, event })
  }
  // Dated entries by date; undated stored events trail, and birth leads when nothing says otherwise.
  return sortEvents(entries)
}
