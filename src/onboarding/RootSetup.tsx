import { CircleQuestionMark, Lock, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useT, type MessageKey } from '../i18n'
import { createGraph, type FamilyGraph } from '../model'
import { GenderPicker } from '../sheet/GenderPicker'
import { NameEditor } from '../sheet/NameEditor'
import { DeceasedFields, NotesField, OtherNamesEditor, PlaceField } from '../sheet/personFields'
import { PersonPhotoField } from '../sheet/PersonPhotoField'
import { usePersonPhoto } from '../sheet/usePersonPhoto'
import {
  emptyValues,
  toPersonFields,
  validate,
  type NameValues,
  type PersonErrors,
  type PersonValues,
} from '../sheet/personValues'
import { DateField } from '../ui/DateField'
import { Button } from '../ui/fields'
import { Logo } from '../ui/Logo'
import { StepDots } from './StepDots'
import { fieldVariants, slideVariants, staggerVariants } from './stepMotion'

const STEPS = ['name', 'gender', 'birth', 'photo', 'more'] as const
type RootStep = (typeof STEPS)[number]

const COPY: Record<RootStep, { title: MessageKey; body: MessageKey }> = {
  name: { title: 'welcome.who', body: 'welcome.nameBody' },
  gender: { title: 'welcome.genderTitle', body: 'welcome.genderBody' },
  birth: { title: 'welcome.birthTitle', body: 'welcome.birthBody' },
  photo: { title: 'welcome.photoTitle', body: 'welcome.photoBody' },
  more: { title: 'welcome.moreTitle', body: 'welcome.moreBody' },
}

type Translate = ReturnType<typeof useT>['t']

interface RootSetupProps {
  onStart: (graph: FamilyGraph) => void
  /** Leaves step 1, back to the chooser. Absent on a first run. */
  onBack?: () => void
  /** What step 1's leave control is called. */
  backLabel?: 'back' | 'cancel'
  /** First run offers import from the name step. The chooser offers it otherwise. */
  showImport?: boolean
  onImport?: () => void
  importError?: string | null
}

/** The first person, one question at a time. Nothing is saved until the last step. */
export function RootSetup({
  onStart,
  onBack,
  backLabel = 'back',
  showImport = false,
  onImport,
  importError = null,
}: RootSetupProps) {
  const { t } = useT()
  const formBase = useId()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [values, setValues] = useState<PersonValues>(emptyValues)
  const [errors, setErrors] = useState<PersonErrors>({})
  const photo = usePersonPhoto(values.photoId, (photoId) => setValues((current) => ({ ...current, photoId })))
  /** Ignores a second Next or Back while the page is still sliding. */
  const moving = useRef(false)
  const submitting = useRef(false)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const formId = `${formBase}-${step}`
  const copy = COPY[step]

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

  const goTo = (next: number) => {
    if (next === index || next < 0 || next >= STEPS.length) return
    if (STEPS[index] === 'photo') photo.cancelCrop()
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const holdMotion = () => {
    moving.current = true
    window.setTimeout(() => {
      moving.current = false
    }, 320)
  }

  const finish = async () => {
    if (submitting.current || photo.busy) return
    const found = validate(values)
    if (found.givenName) {
      setErrors(found)
      goTo(STEPS.indexOf('name'))
      return
    }
    if (found.birthDate) {
      setErrors(found)
      goTo(STEPS.indexOf('birth'))
      return
    }
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    submitting.current = true
    try {
      const photoId = await photo.store()
      if (photoId === null) {
        goTo(STEPS.indexOf('photo'))
        return
      }
      onStart(createGraph(toPersonFields({ ...values, photoId })))
    } finally {
      submitting.current = false
    }
  }

  const forward = () => {
    if (moving.current || photo.busy) return
    if (step === 'name') {
      const found = validate(values)
      if (found.givenName) {
        setErrors({ givenName: found.givenName })
        return
      }
    }
    if (step === 'birth') {
      const found = validate(values)
      if (found.birthDate) {
        setErrors({ birthDate: found.birthDate })
        return
      }
    }
    if (isLast) {
      void finish()
      return
    }
    setErrors({})
    holdMotion()
    goTo(index + 1)
  }

  const back = () => {
    if (moving.current) return
    if (index === 0) {
      onBack?.()
      return
    }
    holdMotion()
    goTo(index - 1)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    forward()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stone-50 px-4">
      <header className="mx-auto flex w-full max-w-md items-center py-4">
        <span className="flex items-center gap-2 font-serif text-xl tracking-tight">
          <Logo />
          KinGraph
        </span>
      </header>

      <main className="relative mx-auto min-h-0 w-full max-w-md flex-1">
        <AnimatePresence initial={false} custom={direction}>
          <motion.section
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            aria-live="polite"
            className="absolute inset-0 overflow-x-hidden overflow-y-auto"
          >
            <form id={formId} onSubmit={submit} noValidate className="flex min-h-full flex-col justify-center py-6">
              <motion.div
                variants={staggerVariants}
                initial="enter"
                animate="center"
                className="flex flex-col gap-5"
              >
                <StepItem>
                  <StepHeading
                    title={t(copy.title)}
                    help={
                      step === 'birth'
                        ? undefined
                        : step === 'more'
                          ? `${t(copy.body)} ${t('welcome.later')}`
                          : t(copy.body)
                    }
                  />
                </StepItem>
                {stepFields({
                  step,
                  t,
                  values,
                  errors,
                  showImport,
                  onImport,
                  importError,
                  photo,
                  setShownName,
                  setNames,
                  update,
                })}
              </motion.div>
            </form>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="mx-auto flex w-full max-w-md flex-col items-center gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <StepDots
          index={index}
          count={STEPS.length}
          label={t('onboarding.stepOf', { step: index + 1, total: STEPS.length })}
        />
        <div className="flex w-full gap-2">
          {(index > 0 || onBack) && (
            <Button className="flex-1" onClick={back}>
              {index === 0 && backLabel === 'cancel' ? t('common.cancel') : t('common.back')}
            </Button>
          )}
          <Button variant="primary" type="submit" form={formId} className="flex-1" disabled={photo.busy}>
            {isLast ? t('welcome.startTree') : t('common.next')}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function StepItem({ children }: { children: ReactNode }) {
  return <motion.div variants={fieldVariants}>{children}</motion.div>
}

/**
 * The step title, with its explanation kept in a "?" beside it. The note
 * shows on hover or focus, centred under the title.
 */
function StepHeading({ title, help }: { title: string; help?: string }) {
  const { t } = useT()
  const id = useId()
  return (
    <div className="text-center">
      <h1 className="relative font-serif text-3xl leading-tight text-balance text-stone-900">
        {title}
        {help && (
          <span className="group ml-2 inline-flex align-middle">
            <button
              type="button"
              aria-label={t('settings.about', { topic: title })}
              aria-describedby={id}
              className="inline-flex -translate-y-0.5 rounded-full p-1 text-stone-400 transition hover:text-stone-600 focus-visible:text-stone-600 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
            >
              <CircleQuestionMark className="size-4" aria-hidden />
            </button>
            <span
              id={id}
              role="tooltip"
              className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 w-[min(18rem,100%)] -translate-x-1/2 rounded-lg bg-stone-900 px-3 py-2 text-left font-sans text-xs leading-relaxed font-normal tracking-normal text-pretty text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {help}
            </span>
          </span>
        )}
      </h1>
    </div>
  )
}

function stepFields({
  step,
  t,
  values,
  errors,
  showImport,
  onImport,
  importError,
  photo,
  setShownName,
  setNames,
  update,
}: {
  step: RootStep
  t: Translate
  values: PersonValues
  errors: PersonErrors
  showImport: boolean
  onImport?: () => void
  importError: string | null
  photo: ReturnType<typeof usePersonPhoto>
  setShownName: (name: NameValues) => void
  setNames: (names: PersonValues['names']) => void
  update: <K extends keyof PersonValues>(field: K, value: PersonValues[K]) => void
}): ReactNode[] {
  switch (step) {
    case 'name':
      return [
        <StepItem key="name">
          <NameEditor
            key={values.names[0].key}
            value={values.names[0]}
            onChange={setShownName}
            shown
            error={errors.givenName}
            autoFocus
          />
        </StepItem>,
        showImport && onImport ? (
          <StepItem key="import">
            <ImportAside onImport={onImport} error={importError} />
          </StepItem>
        ) : null,
      ]
    case 'gender':
      return [
        <StepItem key="gender">
          <GenderPicker variant="cards" value={values.gender} onChange={(gender) => update('gender', gender)} />
        </StepItem>,
      ]
    case 'birth':
      return [
        <StepItem key="birth">
          <div className="flex flex-col gap-4">
            <DateField
              label={t('form.born')}
              help={t('welcome.birthBody')}
              value={values.birthDate}
              onChange={(date) => update('birthDate', date)}
              error={errors.birthDate}
              qualifiers={false}
            />
            <PlaceField
              label={t('form.birthPlace')}
              help={t('welcome.birthPlaceBody')}
              value={values.birthPlace}
              onChange={(place) => update('birthPlace', place)}
            />
          </div>
        </StepItem>,
      ]
    case 'photo':
      return [
        <StepItem key="photo">
          <PersonPhotoField photo={photo} given={values.names[0].given} prominent />
        </StepItem>,
      ]
    case 'more':
      return [
        <StepItem key="names">
          <OtherNamesEditor names={values.names} onChange={setNames} />
        </StepItem>,
        <StepItem key="death">
          <DeceasedFields
            deceased={values.deceased}
            deathDate={values.deathDate}
            deathPlace={values.deathPlace}
            deathDateError={errors.deathDate}
            onDeceased={(deceased) => update('deceased', deceased)}
            onDeathDate={(date) => update('deathDate', date)}
            onDeathPlace={(place) => update('deathPlace', place)}
          />
        </StepItem>,
        <StepItem key="notes">
          <NotesField value={values.notes} onChange={(notes) => update('notes', notes)} />
        </StepItem>,
      ]
    default: {
      const unexpected: never = step
      throw new Error(`Unknown step ${String(unexpected)}`)
    }
  }
}

function ImportAside({ onImport, error }: { onImport: () => void; error: string | null }) {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onImport}
        className="rounded-md text-sm font-medium text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
      >
        {t('welcome.importInstead')}
      </button>
      <p className="text-center text-xs text-stone-500">{t('welcome.importHint')}</p>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-stone-500">
        <Lock className="size-3.5" aria-hidden />
        {t('welcome.private')}
      </p>
    </div>
  )
}
