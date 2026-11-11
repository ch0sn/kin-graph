import { Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { DateField } from '../ui/DateField'
import { PlaceField } from '../ui/PlaceField'
import { Button, Field } from '../ui/fields'
import { HelpLabel } from '../ui/HelpLabel'
import { NameEditor } from './NameEditor'
import { emptyName, type NameValues, type PersonValues } from './personValues'

export { PlaceField }

/** Names other than the one shown, with a way to add, remove, or show one. */
export function OtherNamesEditor({
  names,
  onChange,
  leading,
}: {
  names: PersonValues['names']
  onChange: (names: PersonValues['names']) => void
  /**
   * Sits on the same row as "Add another name". In the person form that row
   * belongs to the portrait grid, and this group centers under the frame.
   */
  leading?: ReactNode
}) {
  const { t } = useT()
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const helpId = useId()

  const setNames = (change: (names: NameValues[]) => NameValues[]) =>
    onChange(change(names) as PersonValues['names'])
  const addName = () => {
    // The name already on the form is the birth name. Another name starts as the name after marriage.
    const name = emptyName({ type: 'married' })
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
    <Button variant="ghost" className="-mr-3 ml-auto w-fit min-w-0 shrink px-3 py-1.5 text-xs" onClick={addName}>
      <Plus className="size-3.5" aria-hidden />
      {t('form.addName')}
    </Button>
  )

  const cards = names.slice(1).map((name) => (
    // No top padding: the kind-row buttons fill that space, matching the bottom inset.
    // Hidden overflow keeps a hovered button inside the rounded edge.
    <div key={name.key} className="overflow-hidden rounded-2xl border border-stone-200 px-3 pt-0 pb-3">
      <NameEditor
        value={name}
        onChange={(next) => setName(name.key, next)}
        autoFocus={name.key === addedKey}
        onRemove={() => removeName(name.key)}
        onShow={() => showName(name.key)}
      />
    </div>
  ))

  // The person editor's grid places the icons in the portrait column.
  if (leading) {
    return (
      <div className="contents">
        <div className="col-start-2 flex justify-center self-center">{leading}</div>
        <div className="col-start-4 flex min-w-0 items-center self-center">{addNameButton}</div>
        {cards.length > 0 && (
          <fieldset className="col-span-4 flex flex-col gap-3 pl-5">
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
            {cards}
          </fieldset>
        )}
      </div>
    )
  }

  const addRow = (
    <div className={`flex items-center gap-3 ${names.length === 1 ? '-mt-2' : ''}`}>
      {addNameButton}
    </div>
  )

  if (names.length === 1) return addRow

  return (
    <div className="flex flex-col gap-3">
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
        {cards}
      </fieldset>
      {addRow}
    </div>
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
