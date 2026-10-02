import { useId, type ComponentProps, type ReactNode } from 'react'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (id: string, describedBy?: string) => ReactNode
}) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {label}
      </label>
      {children(id, message ? messageId : undefined)}
      {message && (
        <p id={messageId} className={`text-xs ${error ? 'text-red-700' : 'text-stone-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

export function TextInput({
  invalid,
  className = '',
  ...props
}: ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={[
        'w-full rounded-xl border bg-white px-3 py-2.5 text-base text-stone-900 outline-none transition placeholder:text-stone-400',
        'focus:border-stone-500 focus:ring-4 focus:ring-stone-200',
        invalid ? 'border-red-400' : 'border-stone-200',
        className,
      ].join(' ')}
      {...props}
    />
  )
}

export interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

/** A single choice from a few options, shown as a row of pills. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={[
              'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition select-none',
              'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-stone-200',
              option.value === value
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
              option.disabled && 'cursor-not-allowed opacity-40',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function CheckboxGroup({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string
  hint?: string
  options: Option<string>[]
  values: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {label}
      </legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2.5 text-sm text-stone-800">
          <input
            type="checkbox"
            className="size-4 accent-stone-900"
            checked={values.includes(option.value)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...values, option.value]
                  : values.filter((v) => v !== option.value),
              )
            }
          />
          {option.label}
        </label>
      ))}
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </fieldset>
  )
}

const BUTTON_STYLES = {
  primary: 'bg-stone-900 text-white hover:bg-stone-800',
  secondary: 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof BUTTON_STYLES }) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        BUTTON_STYLES[variant],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
