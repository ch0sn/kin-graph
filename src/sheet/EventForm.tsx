import { TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { EVENT_KINDS, EVENT_TYPES } from '../model'
import { DateField } from '../ui/DateField'
import { Button, Field, SelectInput, TextInput, type Option } from '../ui/fields'
import {
  CUSTOM_KIND,
  needsLabel,
  toEventFields,
  validateEvent,
  withType,
  type EventErrors,
  type EventValues,
} from './eventValues'
import type { NewLifeEvent } from '../model'

interface EventFormProps {
  initial: EventValues
  /** Shows a Remove button when editing an existing event. */
  onRemove?: () => void
  onSubmit: (event: NewLifeEvent) => void
  onCancel: () => void
}

/** Adds or edits one life event: what it was, when, where and any notes. */
export function EventForm({ initial, onRemove, onSubmit, onCancel }: EventFormProps) {
  const { t } = useT()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<EventErrors>({})

  const update = <K extends keyof EventValues>(field: K, value: EventValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors({})
  }

  const kinds = EVENT_KINDS[values.type]
  const kindOptions: Option<EventValues['kind']>[] = [
    { value: '', label: t('event.general') },
    ...kinds.map((kind) => ({ value: kind, label: t(`eventKind.${kind}`) })),
    { value: CUSTOM_KIND, label: t('event.somethingElse') },
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateEvent(values)
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(toEventFields(values))
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={t('event.type')}>
        {(id) => (
          <SelectInput
            id={id}
            options={EVENT_TYPES.map((type) => ({ value: type, label: t(`event.${type}`) }))}
            value={values.type}
            onChange={(type) => {
              setValues((v) => withType(v, type))
              setErrors({})
            }}
          />
        )}
      </Field>
      {/* Then what exactly happened; "Other" only has its own name. */}
      <AnimatePresence initial={false}>
        {values.type !== 'other' && (
          <motion.div
            key="kind"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <Field label={t('event.kind')}>
              {(id) => (
                <SelectInput
                  id={id}
                  options={kindOptions}
                  value={values.kind}
                  onChange={(kind) => update('kind', kind)}
                />
              )}
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
      {needsLabel(values) && (
        <Field label={t('event.label')} error={errors.label}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!errors.label}
              value={values.label}
              onChange={(e) => update('label', e.target.value)}
              autoFocus
            />
          )}
        </Field>
      )}
      <DateField
        label={t('event.date')}
        value={values.date}
        onChange={(date) => update('date', date)}
        error={errors.date}
      />
      <Field label={t('event.place')}>
        {(id) => (
          <TextInput
            id={id}
            value={values.place}
            onChange={(e) => update('place', e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      <Field label={t('event.description')}>
        {(id) => (
          <TextInput
            id={id}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      {errors.content && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.content}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        {onRemove && (
          <Button
            variant="ghost"
            className="mr-auto text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={onRemove}
          >
            {t('common.remove')}
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit">
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
