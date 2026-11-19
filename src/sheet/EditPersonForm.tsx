import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../i18n'
import { eventsOf, eventTitle, setEvents, updatePerson, type FamilyGraph, type LifeEvent, type NewLifeEvent, type NewPerson, type Person } from '../model'
import type { PersonCardPreferences } from '../storage/settings'
import { EventForm } from './EventForm'
import { FormActionsSlot } from './formActionsSlot'
import { LocationField } from './LocationRow'
import { PersonForm } from './PersonForm'
import { Timeline } from './Timeline'
import { emptyEventValues, valuesFromEvent } from './eventValues'
import { valuesFromPerson } from './personValues'

type EventChange = { event: LifeEvent; added: boolean } | null
type EventChanges = Map<string, EventChange>

function withEventChanges(graph: FamilyGraph, person: Person, changes: EventChanges): FamilyGraph {
  if (changes.size === 0) return graph
  // Apply the draft to the current events, leaving other edits and the original order intact.
  const events = eventsOf(graph, person.id).flatMap((event) =>
    changes.has(event.id) ? changes.get(event.id)?.event ?? [] : event,
  )
  for (const change of changes.values()) if (change?.added) events.push(change.event)
  return setEvents(graph, person.id, events)
}

export function EditPersonForm({
  graph,
  person,
  personCard,
  knownCountries,
  autoFocus,
  error,
  onSubmit,
  onCancel,
}: {
  graph: FamilyGraph
  person: Person
  personCard: PersonCardPreferences
  knownCountries: string[]
  autoFocus: boolean
  error: string | null
  onSubmit: (edit: () => FamilyGraph) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [initial] = useState(() => valuesFromPerson(person))
  const [location, setLocation] = useState<{ text: string; country?: string } | null>(null)
  const [changes, setChanges] = useState<EventChanges>(() => new Map())
  const [editing, setEditing] = useState<{ event?: LifeEvent } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const editingEvent = editing?.event
  const open = editing !== null
  useEffect(() => {
    const modal = dialog.current
    if (open && modal && !modal.open) modal.showModal()
    if (!open && modal?.open) modal.close()
  }, [open])

  const closeEvent = () => setEditing(null)
  const saveEvent = (fields: NewLifeEvent) => {
    const id = editingEvent?.id ?? crypto.randomUUID()
    const event = { ...fields, id, personId: person.id }
    setChanges((current) => new Map(current).set(id, { event, added: !editingEvent || current.get(id)?.added === true }))
    closeEvent()
  }
  const removeEvent = (event: LifeEvent) => {
    setChanges((current) => {
      const next = new Map(current)
      if (current.get(event.id)?.added) next.delete(event.id)
      else next.set(event.id, null)
      return next
    })
    closeEvent()
  }

  const save = (fields: NewPerson) => onSubmit(() => {
    const text = location?.text.trim()
    const next = updatePerson(graph, person.id, {
      ...fields,
      ...(location && { location: text || undefined, locationCountry: text ? location.country : undefined }),
    })
    return withEventChanges(next, person, changes)
  })

  return (
    <>
      <PersonForm initial={initial} submitLabel={t('common.save')} autoFocus={autoFocus} error={error} onCancel={onCancel} onSubmit={save}>
        {!personCard.location && (
          <LocationField
            value={location ?? { text: person.location ?? '', country: person.locationCountry }}
            knownCountries={knownCountries}
            onChange={setLocation}
          />
        )}
      </PersonForm>
      {!personCard.lifeEvents && (
        <Timeline
          graph={withEventChanges(graph, person, changes)}
          personId={person.id}
          omitBirthAndDeath
          onAdd={() => setEditing({})}
          onEdit={(event) => setEditing({ event })}
        />
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto max-h-[85dvh] w-[min(26rem,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 text-stone-900 shadow-2xl backdrop:bg-black/30"
        onCancel={(event) => {
          event.preventDefault()
          closeEvent()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeEvent()
        }}
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <h3 id={titleId} className="font-serif text-xl">
              {editingEvent ? `${t('common.edit')} · ${eventTitle(editingEvent)}` : t('event.add')}
            </h3>
            <FormActionsSlot value={undefined}>
              <EventForm
                initial={editingEvent ? valuesFromEvent(editingEvent) : emptyEventValues()}
                onCancel={closeEvent}
                onRemove={editingEvent && (() => removeEvent(editingEvent))}
                onSubmit={saveEvent}
              />
            </FormActionsSlot>
          </div>
        )}
      </dialog>
    </>
  )
}
