import { t } from '../i18n'
import { isKindOf, type EventKind, type EventType, type LifeEvent, type NewLifeEvent } from '../model'
import { dateError } from './personValues'

/** "Something else…": the event gets its own name instead of a listed kind. */
export const CUSTOM_KIND = 'custom'

/** The event form's fields, as entered. */
export interface EventValues {
  type: EventType
  /** A listed kind, '' for the type in general, or `CUSTOM_KIND` for an own name. */
  kind: EventKind | '' | typeof CUSTOM_KIND
  /** The own name; only used for `other` or a custom kind. */
  label: string
  date: string
  place: string
  description: string
}

export type EventErrors = Partial<Record<'label' | 'date' | 'content', string>>

export function emptyEventValues(overrides: Partial<EventValues> = {}): EventValues {
  return { type: 'education', kind: '', label: '', date: '', place: '', description: '', ...overrides }
}

export function valuesFromEvent(event: LifeEvent): EventValues {
  return {
    type: event.type,
    kind: event.label && event.type !== 'other' ? CUSTOM_KIND : (event.kind ?? ''),
    label: event.label ?? '',
    date: event.date ?? '',
    place: event.place ?? '',
    description: event.description ?? '',
  }
}

/** Whether the form asks for the event's own name. */
export function needsLabel(values: Pick<EventValues, 'type' | 'kind'>): boolean {
  return values.type === 'other' || values.kind === CUSTOM_KIND
}

/** A new type: its kinds differ, so the kind goes back to the type in general. */
export function withType(values: EventValues, type: EventType): EventValues {
  return { ...values, type, kind: values.kind === CUSTOM_KIND ? CUSTOM_KIND : '' }
}

export function validateEvent(values: EventValues): EventErrors {
  const errors: EventErrors = {}
  if (needsLabel(values) && !values.label.trim()) errors.label = t('v.eventName')
  const date = dateError(values.date.trim())
  if (date) errors.date = date
  // An event with nothing to say beyond its type isn't worth a row.
  if (!values.date.trim() && !values.place.trim() && !values.description.trim()) {
    errors.content = t('v.eventNeeded')
  }
  return errors
}

const optional = (text: string) => text.trim() || undefined

/** Converts valid form values to event fields; blank ones are left out. */
export function toEventFields(values: EventValues): NewLifeEvent {
  const { type, kind } = values
  return {
    type,
    kind: isKindOf(type, kind) ? kind : undefined,
    label: needsLabel(values) ? optional(values.label) : undefined,
    date: optional(values.date),
    place: optional(values.place),
    description: optional(values.description),
  }
}
