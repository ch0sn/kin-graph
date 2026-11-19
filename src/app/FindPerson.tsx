import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { childIdsOf, fullName, lifeYears, parentIdsOf, partnerIdsOf, relationshipLabel, siblingsOf, type FamilyGraph, type Person, type PersonId } from '../model'
import { Avatar } from '../ui/Avatar'
import { indexPeople, matchPeople } from './personSearch'

function resultDetails(graph: FamilyGraph, person: Person): string {
  const years = lifeYears(person)
  if (!person.birthDate) {
    const relativeId = [
      ...partnerIdsOf(graph, person.id, { ongoingOnly: true }),
      ...parentIdsOf(graph, person.id),
      ...childIdsOf(graph, person.id),
      ...siblingsOf(graph, person.id).map(({ id }) => id),
    ].find((id) => graph.people[id] && !graph.people[id].isPlaceholder)
    if (relativeId) {
      const name = fullName(graph.people[relativeId])
      const relation = relationshipLabel(graph, relativeId, person.id)
      return [relation ? `${name} (${relation})` : name, years].filter(Boolean).join(' · ')
    }
  }
  return [relationshipLabel(graph, person.id), years].filter(Boolean).join(' · ')
}

export function FindPerson({ graph, onChoose, onClose }: {
  graph: FamilyGraph
  onChoose: (id: PersonId) => void
  onClose: () => void
}) {
  const { t, language } = useT()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
    input.current?.focus()
  }, [])
  const people = useMemo(() => indexPeople(graph.people, language), [graph.people, language])
  const matching = matchPeople(people, query)
  const close = () => {
    dialog.current?.close()
    onClose()
  }

  return (
    <dialog ref={dialog} aria-labelledby="find-person-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }} className="fixed inset-x-0 bottom-0 m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-stone-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-stone-900 shadow-2xl backdrop:bg-black/30 sm:m-auto sm:max-w-md sm:rounded-3xl">
      <div className="flex items-center justify-between">
        <h2 id="find-person-title" className="font-serif text-2xl">{t('mobile.findPerson')}</h2>
        <button type="button" aria-label={t('common.close')} className="grid size-11 place-items-center rounded-xl bg-stone-100" onClick={close}><X className="size-4" aria-hidden /></button>
      </div>
      <label className="my-3 flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:outline-2 focus-within:outline-(--accent)">
        <Search className="size-4 text-stone-500" aria-hidden />
        <input ref={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('mobile.findPerson')} className="min-w-0 flex-1 text-base outline-none" />
      </label>
      <ul className="max-h-[50dvh] overflow-y-auto overscroll-contain">
        {matching.slice(0, 50).map(({ person, name, matchedName }) => (
          <li key={person.id}>
            <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => { close(); onChoose(person.id) }}>
              <div className="aspect-[3/4] h-9 shrink-0">
                <Avatar person={person} cover className="rounded-[7px]! text-xs" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words">{name}</span>
                {matchedName && <span className="block text-sm break-words text-stone-700">{matchedName}</span>}
                <span className="block text-xs text-stone-600">{resultDetails(graph, person)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className={matching.length === 0 ? 'py-3 text-sm text-stone-600' : 'sr-only'}>
        {matching.length === 0 ? t('mobile.noPeople') : ''}
      </p>
      {matching.length > 50 && <p className="py-2 text-sm text-stone-600">{t('mobile.narrowSearch')}</p>}
    </dialog>
  )
}
