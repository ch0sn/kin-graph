import { Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useT } from '../i18n'
import { formatFuzzyDate, isDeceased, type NewPerson, type Person } from '../model'
import { Button } from '../ui/fields'
import { NotesField, VitalFields } from './personFields'
import { toPersonFields, validate, valuesFromPerson, type PersonErrors, type PersonValues } from './personValues'

function CardDetail({
  title,
  hasContent,
  children,
  onEdit,
}: {
  title: string
  hasContent: boolean
  children: ReactNode
  /** While editing, the form below the heading supplies its own actions. */
  onEdit?: () => void
}) {
  const { t } = useT()
  const Icon = hasContent ? Pencil : Plus
  return (
    <section className="flex flex-col gap-2 border-t border-stone-100 pt-4" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{title}</h3>
        {onEdit && (
          <Button variant="ghost" className="-mr-3 px-3 py-1.5" onClick={onEdit}>
            <Icon className="size-4" aria-hidden />
            {t(hasContent ? 'common.edit' : 'common.add')}
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function InlineActions({ onCancel }: { onCancel: () => void }) {
  const { t } = useT()
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
      <Button type="submit" variant="primary">{t('common.save')}</Button>
    </div>
  )
}

export function CardNotes({ notes, onSave }: { notes?: string; onSave: (notes?: string) => void }) {
  const { t } = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(draft?.trim() || undefined)
    setDraft(null)
  }
  return (
    <CardDetail title={t('form.notes')} hasContent={!!notes} onEdit={draft === null ? () => setDraft(notes ?? '') : undefined}>
      {draft === null ? notes && <p className="text-sm break-words whitespace-pre-line text-stone-700">{notes}</p> : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <NotesField value={draft} onChange={setDraft} />
          <InlineActions onCancel={() => setDraft(null)} />
        </form>
      )}
    </CardDetail>
  )
}

type VitalFieldsPatch = Pick<NewPerson, 'birthDate' | 'birthPlace' | 'deceased' | 'deathDate' | 'deathPlace'>

export function CardBirthAndDeath({ person, onSave }: { person: Person; onSave: (fields: VitalFieldsPatch) => void }) {
  const { t } = useT()
  const [draft, setDraft] = useState<PersonValues | null>(null)
  const [errors, setErrors] = useState<PersonErrors>({})
  const born = [person.birthDate && formatFuzzyDate(person.birthDate), person.birthPlace].filter(Boolean).join(' · ')
  const died = [person.deathDate && formatFuzzyDate(person.deathDate), person.deathPlace].filter(Boolean).join(' · ')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const { birthDate: birthError, deathDate: deathError } = validate(draft)
    setErrors({ birthDate: birthError, deathDate: deathError })
    if (birthError || deathError) return
    const { birthDate, birthPlace, deceased, deathDate, deathPlace } = toPersonFields(draft)
    onSave({ birthDate, birthPlace, deceased, deathDate, deathPlace })
    setDraft(null)
  }

  const open = () => {
    setErrors({})
    setDraft(valuesFromPerson(person))
  }

  return (
    <CardDetail title={t('sheet.birthAndDeath')} hasContent={!!born || isDeceased(person)} onEdit={draft === null ? open : undefined}>
      {draft ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <VitalFields values={draft} errors={errors} onChange={(patch) => {
            setDraft({ ...draft, ...patch })
            setErrors({})
          }} />
          <InlineActions onCancel={() => setDraft(null)} />
        </form>
      ) : (
        <dl className="flex flex-col gap-1 text-sm text-stone-700 empty:hidden">
          {born && <div><dt className="inline font-medium">{t('form.born')}</dt><dd className="ml-2 inline">{born}</dd></div>}
          {isDeceased(person) && <div><dt className="inline font-medium">{t(died ? 'form.died' : 'form.deceased')}</dt>{died && <dd className="ml-2 inline">{died}</dd>}</div>}
        </dl>
      )}
    </CardDetail>
  )
}
