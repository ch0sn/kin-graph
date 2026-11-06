import { Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { useT } from '../i18n'
import { DateField } from '../ui/DateField'
import { Button, Field, TextInput } from '../ui/fields'
import { HelpLabel } from '../ui/HelpLabel'
import { NameEditor } from './NameEditor'
import { emptyName, type NameValues, type PersonValues } from './personValues'

export function PlaceField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      {(id) => <TextInput id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />}
    </Field>
  )
}

/** Names other than the one shown, with a way to add, remove, or show one. */
export function OtherNamesEditor({
  names,
  onChange,
}: {
  names: PersonValues['names']
  onChange: (names: PersonValues['names']) => void
}) {
  const { t } = useT()
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const helpId = useId()

  const setNames = (change: (names: NameValues[]) => NameValues[]) =>
    onChange(change(names) as PersonValues['names'])
  const addName = () => {
    const name = emptyName({ type: 'birth' })
    setAddedKey(name.key)
    setNames((current) => [...current, name])
  }
  const removeName = (key: string) => setNames((current) => current.filter((name) => name.key !== key))
  const showName = (key: string) =>
    setNames((current) => [
      ...current.filter((name) => name.key === key),
      ...current.filter((name) => name.key !== key),
    ])
  const setName = (key: string, name: NameValues) =>
    setNames((current) => current.map((item) => (item.key === key ? name : item)))

  const addNameButton = (
    <Button variant="ghost" className="-ml-3 w-fit px-3 py-1.5" onClick={addName}>
      <Plus className="size-4" aria-hidden />
      {t('form.addName')}
    </Button>
  )

  if (names.length === 1) return <div className="-mt-2">{addNameButton}</div>

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 w-full">
        <HelpLabel
          id={helpId}
          about={t('form.otherNames')}
          help={t('form.otherNamesHint')}
          label={
            <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
              {t('form.otherNames')}
            </span>
          }
        />
      </legend>
      {names.slice(1).map((name) => (
        <div key={name.key} className="rounded-2xl border border-stone-200 p-3">
          <NameEditor
            value={name}
            onChange={(next) => setName(name.key, next)}
            autoFocus={name.key === addedKey}
            onRemove={() => removeName(name.key)}
            onShow={() => showName(name.key)}
          />
        </div>
      ))}
      {addNameButton}
    </fieldset>
  )
}

export function DeceasedFields({
  deceased,
  deathDate,
  deathPlace,
  deathDateError,
  onDeceased,
  onDeathDate,
  onDeathPlace,
}: {
  deceased: boolean
  deathDate: string
  deathPlace: string
  deathDateError?: string
  onDeceased: (deceased: boolean) => void
  onDeathDate: (date: string) => void
  onDeathPlace: (place: string) => void
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit items-center gap-2.5 text-sm text-stone-800">
        <input
          type="checkbox"
          className="size-4 accent-stone-900"
          checked={deceased}
          onChange={(event) => onDeceased(event.target.checked)}
        />
        {t('form.deceased')}
      </label>
      <AnimatePresence initial={false}>
        {deceased && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <DateField
              label={t('form.died')}
              value={deathDate}
              onChange={onDeathDate}
              error={deathDateError}
              qualifiers={false}
            />
            <div className="mt-3">
              <PlaceField label={t('form.deathPlace')} value={deathPlace} onChange={onDeathPlace} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useT()
  return (
    <Field label={t('form.notes')}>
      {(id) => (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
        />
      )}
    </Field>
  )
}
