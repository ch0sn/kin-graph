import { useState } from 'react'
import { useT } from '../i18n'
import { joinDate, splitDate, type DateQualifier } from '../model'
import { Field, SelectInput, TextInput } from './fields'

interface DateFieldProps {
  label: string
  /** A date: "YYYY-MM-DD", "YYYY" when only the year is known, "~1890", "<1920", ">1920" or "1910/1915". */
  value: string
  onChange: (value: string) => void
  error?: string
  /**
   * Offers "about", "before", "after" and "between" too. When off, the choice
   * only shows for a date that already has one, so it can still be changed.
   */
  qualifiers?: boolean
}

const QUALIFIERS: DateQualifier[] = ['exact', 'about', 'before', 'after', 'range']

/**
 * Picks a date with the device's calendar. Genealogy often only knows the
 * year, so each date can switch to a plain year, and a date can be "about",
 * "before" or "after" something, or fall between two dates.
 */
export function DateField({ label, value, onChange, error, qualifiers = true }: DateFieldProps) {
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
        value={parts.start}
        onChange={(start) => onChange(joinDate({ ...parts, start }))}
        error={error}
      />
      {qualifier === 'range' && (
        <PlainDateInput
          label={`${label} · ${t('date.to')}`}
          value={parts.end}
          onChange={(end) => onChange(joinDate({ ...parts, end }))}
          min={parts.start.length === 10 ? parts.start : undefined}
        />
      )}
    </div>
  )
}

interface PlainDateInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  min?: string
}

/** One date with no qualifier: a calendar date, or just a year. */
function PlainDateInput({ label, value, onChange, error, min = '1000-01-01' }: PlainDateInputProps) {
  const { t } = useT()
  // Partial dates ("1950", "1950-03") open in year mode so they aren't lost.
  const [yearOnly, setYearOnly] = useState(value !== '' && value.length < 10)

  const switchMode = (toYearOnly: boolean) => {
    setYearOnly(toYearOnly)
    // Keep the year when narrowing; a year alone can't fill a full date.
    onChange(toYearOnly ? value.slice(0, 4) : '')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Field label={label} error={error}>
        {(id, describedBy) =>
          yearOnly ? (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!error}
              value={value.slice(0, 4)}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={t('form.yearPlaceholder')}
              inputMode="numeric"
              autoComplete="off"
            />
          ) : (
            <TextInput
              id={id}
              type="date"
              aria-describedby={describedBy}
              invalid={!!error}
              value={value.length === 10 ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              min={min}
              max={today()}
              className="min-h-[46px]"
            />
          )
        }
      </Field>
      <label className="flex w-fit items-center gap-2 text-xs text-stone-500">
        <input
          type="checkbox"
          className="size-3.5 accent-stone-900"
          checked={yearOnly}
          onChange={(e) => switchMode(e.target.checked)}
        />
        {t('form.yearOnly')}
      </label>
    </div>
  )
}

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
