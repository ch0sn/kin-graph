import { Camera, Mars, TriangleAlert, Venus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Gender, NewPerson } from '../model'
import { storePhoto } from '../photos/photoCache'
import { PhotoError, preparePhoto } from '../photos/preparePhoto'
import { Avatar } from '../ui/Avatar'
import { DateField } from '../ui/DateField'
import { Button, Field, TextInput } from '../ui/fields'
import { toPersonFields, validate, type PersonErrors, type PersonValues } from './personValues'

interface PersonFormProps {
  initial: PersonValues
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
  submitLabel,
  error,
  onSubmit,
  onCancel,
  children,
}: PersonFormProps) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<PersonErrors>({})
  /** A photo chosen in this form that isn't stored yet. */
  const [newPhoto, setNewPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (newPhoto && URL.revokeObjectURL(newPhoto.url)), [newPhoto])

  const update = <K extends keyof PersonValues>(field: K, value: PersonValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const choosePhoto = async (file: File) => {
    try {
      const blob = await preparePhoto(file)
      setNewPhoto({ blob, url: URL.createObjectURL(blob) })
      setPhotoError(null)
    } catch (e) {
      setPhotoError(e instanceof PhotoError ? e.message : 'This image couldn’t be used.')
    }
  }

  const removePhoto = () => {
    setNewPhoto(null)
    update('photoId', '')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || busy) return

    let { photoId } = values
    if (newPhoto) {
      setBusy(true)
      try {
        photoId = await storePhoto(newPhoto.blob)
      } catch {
        setPhotoError('The photo couldn’t be saved on this device.')
        return
      } finally {
        setBusy(false)
      }
      // Stored now, so a retry after a rejected edit doesn't store it twice.
      update('photoId', photoId)
      setNewPhoto(null)
    }
    onSubmit(toPersonFields({ ...values, photoId }))
  }

  const hasPhoto = newPhoto !== null || values.photoId !== ''

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label={hasPhoto ? 'Change photo' : 'Add a photo'}
          className="group relative shrink-0 rounded-full focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
        >
          {hasPhoto ? (
            <Avatar
              person={{ ...values, photoId: values.photoId || undefined }}
              size="lg"
              src={newPhoto ? newPhoto.url : undefined}
            />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 transition group-hover:border-stone-400 group-hover:text-stone-600">
              <Camera className="size-7" strokeWidth={1.5} aria-hidden />
            </span>
          )}
          {hasPhoto && (
            <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-white">
              <Camera className="size-3.5" aria-hidden />
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <div className="flex gap-1">
            <Button variant="ghost" className="-ml-3 px-3 py-1.5" onClick={() => fileInput.current?.click()}>
              {hasPhoto ? 'Change photo' : 'Add a photo'}
            </Button>
            {hasPhoto && (
              <Button
                variant="ghost"
                className="px-3 py-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={removePhoto}
              >
                Remove
              </Button>
            )}
          </div>
          <p className={`text-xs ${photoError ? 'text-red-700' : 'text-stone-500'}`}>
            {photoError ?? 'Optional — helps you recognise them at a glance.'}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="photo-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void choosePhoto(file)
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.givenName}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!errors.givenName}
              value={values.givenName}
              onChange={(e) => update('givenName', e.target.value)}
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
              onChange={(e) => update('familyName', e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <DateField
        label="Born"
        value={values.birthDate}
        onChange={(date) => update('birthDate', date)}
        error={errors.birthDate}
      />

      <div className="flex flex-col gap-3">
        <label className="flex w-fit items-center gap-2.5 text-sm text-stone-800">
          <input
            type="checkbox"
            className="size-4 accent-stone-900"
            checked={values.deceased}
            onChange={(e) => update('deceased', e.target.checked)}
          />
          Deceased
        </label>
        <AnimatePresence initial={false}>
          {values.deceased && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <DateField
                label="Died"
                value={values.deathDate}
                onChange={(date) => update('deathDate', date)}
                error={errors.deathDate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GenderPicker value={values.gender} onChange={(gender) => update('gender', gender)} />

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
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female', Icon: Venus },
  { value: 'male', label: 'Male', Icon: Mars },
] as const

/** Icon toggles; tapping the selected one again clears it. */
function GenderPicker({
  value,
  onChange,
}: {
  value: Gender | ''
  onChange: (value: Gender | '') => void
}) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        Gender
      </span>
      <div className="flex gap-2">
        {GENDER_OPTIONS.map(({ value: option, label, Icon }) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              title={label}
              onClick={() => onChange(selected ? '' : option)}
              className={[
                'flex size-11 items-center justify-center rounded-full border transition active:scale-95',
                'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
                selected
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800',
              ].join(' ')}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}
