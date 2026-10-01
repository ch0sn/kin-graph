import { TriangleAlert } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { NewPerson } from '../model'
import { Button, Field, Segmented, TextInput } from './fields'
import { toPersonFields, validate, type PersonErrors, type PersonValues } from './personValues'

interface PersonFormProps {
  initial: PersonValues
  submitLabel: string
  /** An error from applying the change, e.g. a rejected relationship. */
  error: string | null
  onSubmit: (person: NewPerson) => void
  onCancel: () => void
  /** Relationship-specific options, shown below the person's details. */
  children?: ReactNode
}

const GENDERS = [
  { value: '' as const, label: 'Not set' },
  { value: 'female' as const, label: 'Female' },
  { value: 'male' as const, label: 'Male' },
  { value: 'other' as const, label: 'Other' },
]

export function PersonForm({
  initial,
  submitLabel,
  error,
  onSubmit,
  onCancel,
  children,
}: PersonFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<PersonErrors>({})
  const set = (field: keyof PersonValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(toPersonFields(values))
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.givenName}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!errors.givenName}
              value={values.givenName}
              onChange={(e) => set('givenName')(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          )}
        </Field>
        <Field label="Last name">
          {(id) => (
            <TextInput
              id={id}
              value={values.familyName}
              onChange={(e) => set('familyName')(e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Born" error={errors.birthDate}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!errors.birthDate}
              value={values.birthDate}
              onChange={(e) => set('birthDate')(e.target.value)}
              placeholder="YYYY-MM-DD"
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Died" error={errors.deathDate}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!errors.deathDate}
              value={values.deathDate}
              onChange={(e) => set('deathDate')(e.target.value)}
              placeholder="If applicable"
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </Field>
      </div>
      <Segmented label="Gender" options={GENDERS} value={values.gender} onChange={set('gender')} />
      {children}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
