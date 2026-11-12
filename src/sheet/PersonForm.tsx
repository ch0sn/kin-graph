import { TriangleAlert } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { NewPerson } from '../model'
import { useT } from '../i18n'
import { DateField } from '../ui/DateField'
import { NameEditor } from './NameEditor'
import {
  surnameFollows,
  toPersonFields,
  validate,
  withSuggestedSurname,
  type NameValues,
  type PersonErrors,
  type PersonValues,
} from './personValues'
import { FormActions } from './FormActions'
import { GenderPicker } from './GenderPicker'
import { DeceasedFields, NotesField, OtherNamesEditor, PlaceField } from './personFields'
import { PersonPhotoField } from './PersonPhotoField'
import { usePersonPhoto } from './usePersonPhoto'

interface PersonFormProps {
  initial: PersonValues
  /**
   * Last name to keep in the shown name until it is edited. `null` clears it.
   * Left unset on forms that don't suggest one.
   */
  suggestedSurnames?: string[] | null
  submitLabel: string
  /** An error from applying the change, e.g. a rejected relationship. */
  error: string | null
  onSubmit: (person: NewPerson) => void
  /** Shows a Cancel button when given. */
  onCancel?: () => void
  /** Relationship-specific options, shown below the person's details. */
  children?: ReactNode
}

export function PersonForm({
  initial,
  suggestedSurnames,
  submitLabel,
  error,
  onSubmit,
  onCancel,
  children,
}: PersonFormProps) {
  const { t } = useT()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<PersonErrors>({})
  // Changing the other parent updates the last name while it still matches the previous suggestion.
  const suggestionKey = JSON.stringify(suggestedSurnames ?? null)
  const [applied, setApplied] = useState(() =>
    suggestedSurnames === undefined ? null : { key: suggestionKey, surnames: suggestedSurnames },
  )
  if (suggestedSurnames !== undefined && applied?.key !== suggestionKey) {
    const previous = applied?.surnames ?? null
    setApplied({ key: suggestionKey, surnames: suggestedSurnames })
    setValues((current) => {
      const [shown, ...rest] = current.names
      if (!surnameFollows(shown, previous)) return current
      return { ...current, names: [withSuggestedSurname(shown, suggestedSurnames), ...rest] }
    })
  }
  const formId = useId()
  const photo = usePersonPhoto(values.photoId, (photoId) => setValues((current) => ({ ...current, photoId })))

  const update = <K extends keyof PersonValues>(field: K, value: PersonValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const setNames = (names: PersonValues['names']) => {
    setValues((current) => ({ ...current, names }))
    setErrors((current) => ({ ...current, givenName: undefined }))
  }
  const setShownName = (name: NameValues) => {
    setValues((current) => ({ ...current, names: [name, ...current.names.slice(1)] }))
    setErrors((current) => ({ ...current, givenName: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || photo.busy) return

    const photoId = await photo.store()
    if (photoId === null) return
    onSubmit(toPersonFields({ ...values, photoId }))
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/*
        The portrait steps out of the sheet's left padding so its side gaps match.
        Gender shares that grid and centers in the portrait's column.
      */}
      <div className="-ml-5 grid grid-cols-[0.5rem_auto_0.5rem_minmax(0,1fr)] gap-y-2">
        <PersonPhotoField photo={photo} given={values.names[0].given}>
          <NameEditor
            key={values.names[0].key}
            value={values.names[0]}
            onChange={setShownName}
            shown
            layout="stack"
            error={errors.givenName}
            autoFocus
          />
        </PersonPhotoField>

        <OtherNamesEditor
          names={values.names}
          onChange={setNames}
          leading={<GenderPicker value={values.gender} onChange={(gender) => update('gender', gender)} />}
        />
      </div>

      <DateField
        label={t('form.born')}
        value={values.birthDate}
        onChange={(date) => update('birthDate', date)}
        error={errors.birthDate}
        qualifiers={false}
      />
      <PlaceField
        label={t('form.birthPlace')}
        value={values.birthPlace}
        onChange={(place) => update('birthPlace', place)}
      />

      <DeceasedFields
        deceased={values.deceased}
        deathDate={values.deathDate}
        deathPlace={values.deathPlace}
        deathDateError={errors.deathDate}
        onDeceased={(deceased) => update('deceased', deceased)}
        onDeathDate={(date) => update('deathDate', date)}
        onDeathPlace={(place) => update('deathPlace', place)}
      />

      <NotesField value={values.notes} onChange={(notes) => update('notes', notes)} />

      {children}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <FormActions formId={formId} submitLabel={submitLabel} onCancel={onCancel} busy={photo.busy} />
    </form>
  )
}
