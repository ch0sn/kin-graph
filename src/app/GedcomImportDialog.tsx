import { useMemo, useState } from 'react'
import type { GedcomImport } from '../gedcom/import'
import { useT } from '../i18n'
import { fullName, peopleCount, type FamilyGraph, type PersonId } from '../model'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { SelectInput } from '../ui/fields'

interface GedcomImportDialogProps {
  imported: GedcomImport
  onConfirm: (graph: FamilyGraph) => void
  onCancel: () => void
}

/** After a GEDCOM file is read: choose who "me" is, and see what couldn't be imported. */
export function GedcomImportDialog({ imported, onConfirm, onCancel }: GedcomImportDialogProps) {
  const { t } = useT()
  const { graph, report } = imported
  const [managerId, setManagerId] = useState(graph.managerId)

  const options = useMemo(
    () =>
      Object.values(graph.people)
        .filter((p) => !p.isPlaceholder)
        .map((p) => ({
          value: p.id,
          label: [fullName(p), p.birthDate?.slice(0, 4) && `(${p.birthDate.slice(0, 4)})`]
            .filter(Boolean)
            .join(' '),
          sort: fullName(p),
        }))
        .sort((a, b) => a.sort.localeCompare(b.sort)),
    [graph.people],
  )
  const disconnected = useMemo(() => unrelatedCount(graph, managerId), [graph, managerId])

  const notes: string[] = []
  const tags = Object.entries(report.unsupported)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => `${tag} (${count})`)
  if (tags.length) notes.push(t('gedcom.unsupported', { tags: tags.join(', ') }))
  if (report.approximateDates) notes.push(t('gedcom.approximate', { count: report.approximateDates }))
  if (report.droppedDates) notes.push(t('gedcom.dropped', { count: report.droppedDates }))
  if (report.skippedLinks) notes.push(t('gedcom.links', { count: report.skippedLinks }))
  if (report.malformedLines) notes.push(t('gedcom.malformed', { count: report.malformedLines }))
  if (report.legacyEncoding) notes.push(t('gedcom.legacy'))
  if (disconnected) notes.push(t('gedcom.disconnected', { count: disconnected }))

  return (
    <ConfirmDialog
      open
      title={t('gedcom.title')}
      confirmLabel={t('gedcom.import')}
      cancelLabel={t('common.cancel')}
      onConfirm={() => onConfirm({ ...graph, managerId })}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        <p>
          {t('gedcom.summary', {
            people: peopleCount(graph),
            families: t('families', { count: report.families }),
          })}
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gedcom-me" className="text-sm font-semibold text-stone-900">
            {t('gedcom.whoAreYou')}
          </label>
          <SelectInput id="gedcom-me" options={options} value={managerId} onChange={setManagerId} />
          <p className="text-xs text-stone-500">{t('gedcom.whoHelp')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-stone-900">{t('gedcom.skippedTitle')}</h3>
          {notes.length === 0 ? (
            <p>{t('gedcom.allImported')}</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ConfirmDialog>
  )
}

/** How many real people can't be reached from `rootId` through parents, children or partners. */
function unrelatedCount(graph: FamilyGraph, rootId: PersonId): number {
  const neighbours = new Map<PersonId, PersonId[]>()
  const connect = (a: PersonId, b: PersonId) => {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b])
    neighbours.set(b, [...(neighbours.get(b) ?? []), a])
  }
  for (const l of graph.parentLinks) connect(l.parentId, l.childId)
  for (const p of graph.partnerships) connect(p.partnerIds[0], p.partnerIds[1])

  const seen = new Set([rootId])
  const queue = [rootId]
  while (queue.length) {
    for (const next of neighbours.get(queue.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return Object.values(graph.people).filter((p) => !p.isPlaceholder && !seen.has(p.id)).length
}
