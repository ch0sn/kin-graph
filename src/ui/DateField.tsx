import { useId, useState } from 'react'
import { useT } from '../i18n'
import {
  calendarFields,
  fromCalendarFields,
  joinDate,
  splitDate,
  type CalendarFields,
  type DateQualifier,
} from '../model'
import { Field, SelectInput, TextInput, type Option } from './fields'

interface DateFieldProps {
  label: string
  /** A date: "YYYY", "YYYY-MM", "YYYY-MM-DD", or with "~", "<", ">" or "a/b". */
  value: string
  onChange: (value: string) => void
  error?: string
  /** A short note under the label, smaller than the fields. */
  help?: string
  /**
   * Offers "about", "before", "after" and "between" too. When off, the choice
   * only shows for a date that already has one, so it can still be changed.
   */
  qualifiers?: boolean
}

const QUALIFIERS: DateQualifier[] = ['exact', 'about', 'before', 'after', 'range']
type DatePart = 'year' | 'month' | 'day'
const DATE_PARTS: readonly DatePart[] = ['year', 'month', 'day']

/**
 * A date at whatever precision is known. Year, then month, then day. Month and
 * day stay locked until the year has four digits; the day also stays locked
 * until a month is chosen. A blank month or day is left out of what is saved
 * ("1950", "1950-03", "1950-03-14"). A date can also be "about", "before" or
 * "after" something, or fall between two dates.
 */
export function DateField({ label, value, onChange, error, help, qualifiers = true }: DateFieldProps) {
  const { t } = useT()
  // Kept apart from the value: choosing "about" before typing anything has no text to show it.
  const [qualifier, setQualifier] = useState(() => splitDate(value).qualifier)
  const parts = { ...splitDate(value), qualifier }

  const options = QUALIFIERS.map((q) => ({ value: q, label: t(`date.${q}Option`) }))

  const showQualifier = qualifiers || qualifier !== 'exact'

  return (
    <div className="flex flex-col gap-2">
      {showQualifier && (
        <SelectInput
          aria-label={`${label}: ${t('date.kind')}`}
          options={options}
          value={qualifier}
          onChange={(next) => {
            setQualifier(next)
            onChange(joinDate({ ...parts, qualifier: next }))
          }}
          className="w-fit text-sm"
        />
      )}
      <PlainDateInput
        label={qualifier === 'range' ? `${label} · ${t('date.from')}` : label}
        help={help}
        value={parts.start}
        onChange={(start) => onChange(joinDate({ ...parts, start }))}
        error={error}
      />
      {qualifier === 'range' && (
        <PlainDateInput
          label={`${label} · ${t('date.to')}`}
          value={parts.end}
          onChange={(end) => onChange(joinDate({ ...parts, end }))}
        />
      )}
    </div>
  )
}

/** One date with no qualifier. Empty day or month means that part is unknown. */
function PlainDateInput({
  label,
  help,
  value,
  onChange,
  error,
}: {
  label: string
  help?: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const { language } = useT()
  const labelId = useId()
  const helpId = useId()
  const errorId = useId()
  const fields = calendarFields(value)
  const describedBy = [help ? helpId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  const change = (next: CalendarFields) => onChange(fromCalendarFields(next))
  const months = monthOptions(language)
  const days = dayOptions(fields.year, fields.month, fields.day)

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy}>
      <legend id={labelId} className="mb-1.5 w-full">
        <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</span>
        {help && (
          <p id={helpId} className="mt-1 text-xs leading-snug font-normal tracking-normal text-stone-400 normal-case">
            {help}
          </p>
        )}
      </legend>
      <div className="flex gap-2">
        {DATE_PARTS.map((part) => (
          <DatePartField
            key={part}
            part={part}
            fields={fields}
            months={months}
            days={days}
            describedBy={describedBy}
            invalid={!!error}
            onChange={change}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function DatePartField({
  part,
  fields,
  months,
  days,
  describedBy,
  invalid,
  onChange,
}: {
  part: DatePart
  fields: CalendarFields
  months: Option<string>[]
  days: Option<string>[]
  describedBy?: string
  invalid: boolean
  onChange: (next: CalendarFields) => void
}) {
  const { t } = useT()
  const yearKnown = fields.year.length === 4
  const width = part === 'month' ? 'min-w-0 flex-1' : part === 'year' ? 'w-[5.5rem] shrink-0' : 'w-[4.5rem] shrink-0'

  return (
    <div className={width}>
      <Field label={t(`form.${part}`)}>
        {(id) => {
          switch (part) {
            case 'day':
              return (
                <SelectInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  options={days}
                  value={fields.day}
                  disabled={!yearKnown || fields.month === ''}
                  onChange={(day) => onChange({ ...fields, day })}
                />
              )
            case 'month':
              return (
                <SelectInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  options={months}
                  value={fields.month}
                  disabled={!yearKnown}
                  onChange={(month) =>
                    onChange({
                      ...fields,
                      month,
                      day: dayStillFits(fields.year, month, fields.day) ? fields.day : '',
                    })
                  }
                />
              )
            case 'year':
              return (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={fields.year}
                  onChange={(event) => {
                    const year = event.target.value.replace(/\D/g, '').slice(0, 4)
                    const known = year.length === 4
                    onChange({
                      ...fields,
                      year,
                      month: known ? fields.month : '',
                      day: known && dayStillFits(year, fields.month, fields.day) ? fields.day : '',
                    })
                  }}
                  placeholder={t('form.yearPlaceholder')}
                  inputMode="numeric"
                  autoComplete="off"
                />
              )
            default: {
              const unexpected: never = part
              return unexpected
            }
          }
        }}
      </Field>
    </div>
  )
}

function monthOptions(language: string): Option<string>[] {
  const format = new Intl.DateTimeFormat(language, { month: 'long' })
  return [
    { value: '', label: '—' },
    ...Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: format.format(new Date(2000, index, 1)),
    })),
  ]
}

function dayOptions(year: string, month: string, selected: string): Option<string>[] {
  const count = daysInMonth(year, month)
  const options = [
    { value: '', label: '—' },
    ...Array.from({ length: count }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: String(index + 1),
    })),
  ]
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: String(Number(selected)) })
  }
  return options
}

function daysInMonth(year: string, month: string): number {
  const m = Number(month)
  if (!m || m < 1 || m > 12) return 31
  // An unfinished year still offers 29 February; a finished one follows the calendar.
  const y = year.length === 4 ? Number(year) : 2000
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function dayStillFits(year: string, month: string, day: string): boolean {
  if (!day || !month) return false
  return Number(day) <= daysInMonth(year, month)
}
