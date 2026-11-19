import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { fullName, lifeYears, relationshipLabel, type FamilyGraph, type PersonId } from '../model'
import { foldMarks } from '../places/speak'
import { Avatar } from '../ui/Avatar'

export function FindPerson({ graph, onChoose, onClose }: {
  graph: FamilyGraph
  onChoose: (id: PersonId) => void
  onClose: () => void
}) {
  const { t, language } = useT()
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const people = useMemo(() => Object.values(graph.people)
    .filter((person) => !person.isPlaceholder)
    .map((person) => {
      const name = fullName(person)
      return { person, name, search: foldMarks(name) }
    })
    .sort((a, b) => a.name.localeCompare(b.name, language)), [graph.people, language])
  const words = foldMarks(query).trim().split(/\s+/)
  const matching = people.filter(({ search }) => words.every((word) => search.includes(word)))

  return (
    <dialog ref={dialog} aria-labelledby="find-person-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-x-0 bottom-0 m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-stone-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-stone-900 shadow-2xl backdrop:bg-black/30 sm:m-auto sm:max-w-md sm:rounded-3xl">
      <div className="flex items-center justify-between">
        <h2 id="find-person-title" className="font-serif text-2xl">{t('mobile.findPerson')}</h2>
        <button type="button" aria-label={t('common.close')} className="grid size-11 place-items-center rounded-xl bg-stone-100" onClick={onClose}><X className="size-4" aria-hidden /></button>
      </div>
      <label className="my-3 flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 focus-within:outline-2 focus-within:outline-(--accent)">
        <Search className="size-4 text-stone-500" aria-hidden />
        <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('mobile.findPerson')} className="min-w-0 flex-1 text-base outline-none" />
      </label>
      <ul className="max-h-[50dvh] overflow-y-auto overscroll-contain">
        {matching.slice(0, 50).map(({ person, name }) => (
          <li key={person.id}>
            <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => onChoose(person.id)}>
              <div className="aspect-[3/4] h-9 shrink-0">
                <Avatar person={person} cover className="rounded-[7px]! text-xs" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words">{name}</span>
                <span className="block text-xs text-stone-600">{[relationshipLabel(graph, person.id), lifeYears(person)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {matching.length === 0 && <p className="py-3 text-sm text-stone-600">{t('mobile.noPeople')}</p>}
      {matching.length > 50 && <p className="py-2 text-sm text-stone-600">{t('mobile.narrowSearch')}</p>}
    </dialog>
  )
}
