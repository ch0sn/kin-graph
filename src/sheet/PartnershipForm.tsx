import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { isCertainlyBefore, type FuzzyDate, type PartnershipStatus } from '../model'
import { DateField } from '../ui/DateField'
import { Button, Segmented } from '../ui/fields'
import { dateError } from './personValues'

const STATUSES: PartnershipStatus[] = ['married', 'partnered', 'separated', 'divorced', 'widowed']

interface PartnershipFields {
  status: PartnershipStatus
  startDate?: FuzzyDate
  endDate?: FuzzyDate
}

interface PartnershipFormProps {
  /** The partnership being edited, or the starting values for a new one. */
  partnership: PartnershipFields
  onSubmit: (patch: PartnershipFields) => void
  onCancel: () => void
}

/** Edits how two people are partnered: the status, and when it began and ended. */
export function PartnershipForm({ partnership, onSubmit, onCancel }: PartnershipFormProps) {
  const { t } = useT()
  const [status, setStatus] = useState(partnership.status)
  const [start, setStart] = useState(partnership.startDate ?? '')
  const [end, setEnd] = useState(partnership.endDate ?? '')
  const [errors, setErrors] = useState<{ start?: string; end?: string }>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = { start: dateError(start.trim()), end: dateError(end.trim()) }
    if (!found.start && !found.end && start.trim() && end.trim() && isCertainlyBefore(end.trim(), start.trim())) {
      found.end = t('v.endBeforeStart')
    }
    setErrors(found)
    if (found.start || found.end) return
    onSubmit({ status, startDate: start.trim() || undefined, endDate: end.trim() || undefined })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Segmented
        label={t('form.status')}
        options={STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
        value={status}
        onChange={setStatus}
      />
      <DateField label={t('partnership.start')} value={start} onChange={setStart} error={errors.start} />
      <DateField label={t('partnership.end')} value={end} onChange={setEnd} error={errors.end} />
      <div className="flex justify-end gap-2 pt-1">
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
