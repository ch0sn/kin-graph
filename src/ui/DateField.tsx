import { useState } from 'react'
import { useT } from '../i18n'
import { Field, TextInput } from './fields'

interface DateFieldProps {
  label: string
  /** A fuzzy date: "YYYY-MM-DD", or "YYYY" when only the year is known. */
  value: string
  onChange: (value: string) => void
  error?: string
}

/**
 * Picks a date with the device's calendar. Genealogy often only knows the
 * year, so the field can switch to a plain year instead.
 */
export function DateField({ label, value, onChange, error }: DateFieldProps) {
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
              min="1000-01-01"
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
