import { Pencil, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'
import {
  eventTitle,
  fullName,
  formatFuzzyDate,
  isExactDate,
  timelineOf,
  type FamilyGraph,
  type LifeEvent,
  type PersonId,
  type TimelineEntry,
} from '../model'
import { Button } from '../ui/fields'

interface TimelineProps {
  graph: FamilyGraph
  personId: PersonId
  onAdd: () => void
  onEdit: (event: LifeEvent) => void
  /** Shown at the top of the section, above the heading. */
  before?: ReactNode
}

/**
 * A person's life in date order: birth, death and marriages from their
 * record, with the events added to it. Approximate dates get a dashed marker.
 */
export function Timeline({ graph, personId, onAdd, onEdit, before }: TimelineProps) {
  const { t } = useT()
  const entries = timelineOf(graph, personId)

  return (
    <section aria-labelledby="timeline-title" className="flex flex-col gap-2 border-t border-stone-100 pt-4">
      {before && <div className="mb-3">{before}</div>}
      <div className="flex items-center justify-between">
        <h3
          id="timeline-title"
          className="text-xs font-semibold tracking-wide text-stone-500 uppercase"
        >
          {t('event.title')}
        </h3>
        <Button variant="ghost" className="-mr-3 px-3 py-1.5" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          {t('event.add')}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-stone-400">{t('event.empty')}</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) => (
            <Entry key={entry.key} entry={entry} graph={graph} onEdit={onEdit} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Entry({
  entry,
  graph,
  onEdit,
}: {
  entry: TimelineEntry
  graph: FamilyGraph
  onEdit: (event: LifeEvent) => void
}) {
  const { t } = useT()
  const approximate = entry.date !== undefined && !isExactDate(entry.date)
  const title = eventTitle(entry)
  const partner = entry.partnerId && graph.people[entry.partnerId]
  const details = [
    partner && t('event.with', { name: fullName(partner) }),
    entry.place,
    entry.description,
  ].filter(Boolean)

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center" aria-hidden>
        <span
          className={[
            'mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-stone-400',
            approximate ? 'border-dashed bg-white' : 'bg-stone-400',
          ].join(' ')}
        />
        <span className="w-px flex-1 bg-stone-200" />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <p className="text-sm text-stone-900">
          <span className="font-medium">{title}</span>
          {entry.date && (
            <span className={`text-stone-500 ${approximate ? 'italic' : ''}`}>
              {' · '}
              {formatFuzzyDate(entry.date)}
            </span>
          )}
        </p>
        {details.length > 0 && <p className="text-xs text-stone-500">{details.join(' · ')}</p>}
      </div>
      {entry.event && (
        <button
          type="button"
          onClick={() => onEdit(entry.event!)}
          aria-label={`${t('sheet.edit')}: ${title}`}
          className="self-start rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      )}
    </li>
  )
}
