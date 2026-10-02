import { Camera, Mars, TriangleAlert, Venus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Gender, NewPerson } from '../model'
import { squareCrop, type Crop } from '../photos/crop'
import { PhotoCropDialog } from '../photos/PhotoCropDialog'
import { useT } from '../i18n'
import { storePhoto } from '../photos/photoCache'
import {
  loadPhotoSource,
  PhotoError,
  preparePhoto,
  type PhotoSource,
} from '../photos/preparePhoto'
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

interface ChosenPhoto {
  blob: Blob
  url: string
  /** The original image and the crop taken from it, for adjusting later. */
  source: PhotoSource
  crop: Crop
}

export function PersonForm({
  initial,
  submitLabel,
  error,
  onSubmit,
  onCancel,
  children,
}: PersonFormProps) {
  const { t } = useT()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<PersonErrors>({})
  /** A photo chosen in this form that isn't stored yet; its crop can still change. */
  const [newPhoto, setNewPhoto] = useState<ChosenPhoto | null>(null)
  /** The image being positioned in the crop dialog, if it's open. */
  const [cropping, setCropping] = useState<{ source: PhotoSource; crop: Crop } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Release image memory once a photo or its original are no longer needed.
  useEffect(() => () => void (newPhoto && URL.revokeObjectURL(newPhoto.url)), [newPhoto])
  const source = newPhoto?.source
  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source])

  const update = <K extends keyof PersonValues>(field: K, value: PersonValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const showPhotoError = (e: unknown) =>
    setPhotoError(e instanceof PhotoError ? e.message : t('photo.unusable'))

  const choosePhoto = async (file: File) => {
    try {
      const picked = await loadPhotoSource(file)
      setCropping({ source: picked, crop: squareCrop(picked.width, picked.height) })
      setPhotoError(null)
    } catch (e) {
      showPhotoError(e)
    }
  }

  const confirmCrop = async (crop: Crop) => {
    if (!cropping) return
    const picked = cropping.source
    setCropping(null)
    try {
      const blob = await preparePhoto(picked.file, crop)
      setNewPhoto({ blob, url: URL.createObjectURL(blob), source: picked, crop })
    } catch (e) {
      showPhotoError(e)
      if (picked !== source) URL.revokeObjectURL(picked.url)
    }
  }

  const cancelCrop = () => {
    // A newly picked image that was never used can go; one being re-adjusted stays.
    if (cropping && cropping.source !== source) URL.revokeObjectURL(cropping.source.url)
    setCropping(null)
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
        setPhotoError(t('photo.storeFailed'))
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
          aria-label={hasPhoto ? t('form.changePhoto') : t('form.addPhoto')}
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
        {(hasPhoto || photoError) && (
          <div className="flex min-w-0 flex-col items-start gap-1">
            {hasPhoto && (
              <div className="-ml-3 flex flex-wrap gap-1">
                {newPhoto && (
                  <Button
                    variant="ghost"
                    className="px-3 py-1.5"
                    onClick={() => setCropping({ source: newPhoto.source, crop: newPhoto.crop })}
                  >
                    {t('form.adjust')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="px-3 py-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={removePhoto}
                >
                  {t('common.remove')}
                </Button>
              </div>
            )}
            {photoError && <p className="text-xs text-red-700">{photoError}</p>}
          </div>
        )}
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
        <PhotoCropDialog
          source={cropping?.source ?? null}
          initialCrop={cropping?.crop ?? null}
          onConfirm={(crop) => void confirmCrop(crop)}
          onCancel={cancelCrop}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.firstName')} error={errors.givenName}>
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
        <Field label={t('form.lastName')}>
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

      <GenderPicker value={values.gender} onChange={(gender) => update('gender', gender)} />

      <DateField
        label={t('form.born')}
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
          {t('form.deceased')}
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
                label={t('form.died')}
                value={values.deathDate}
                onChange={(date) => update('deathDate', date)}
                error={errors.deathDate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
            {t('common.cancel')}
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
  { value: 'female', label: 'gender.female', Icon: Venus },
  { value: 'male', label: 'gender.male', Icon: Mars },
] as const

/** Icon toggles; tapping the selected one again clears it. */
function GenderPicker({
  value,
  onChange,
}: {
  value: Gender | ''
  onChange: (value: Gender | '') => void
}) {
  const { t } = useT()
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {t('form.gender')}
      </span>
      <div className="flex gap-2">
        {GENDER_OPTIONS.map(({ value: option, label, Icon }) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              aria-label={t(label)}
              aria-pressed={selected}
              title={t(label)}
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
