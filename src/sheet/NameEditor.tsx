import { ArrowUpToLine, Trash } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'
import type { NameType } from '../model'
import { Field, SelectInput, TextInput, type Option } from '../ui/fields'
import type { NameValues } from './personValues'

/** The kinds a name added in the form can be. */
const NAME_TYPES: NameType[] = ['birth', 'nickname']

interface NameEditorProps {
  value: NameValues
  onChange: (value: NameValues) => void
  /** The name that's shown; other names also have a kind, and buttons to show or remove them. */
  shown?: boolean
  /** An error for the first name field. */
  error?: string
  autoFocus?: boolean
  onRemove?: () => void
  onShow?: () => void
}

/** Edits one name's first and last name. */
export function NameEditor({
  value,
  onChange,
  shown = false,
  error,
  autoFocus,
  onRemove,
  onShow,
}: NameEditorProps) {
  const { t } = useT()
  const set = <K extends keyof NameValues>(field: K, next: NameValues[K]) =>
    onChange({ ...value, [field]: next })

  // A kind from elsewhere (e.g. an imported married name) stays selectable.
  const types =
    value.type && !NAME_TYPES.includes(value.type) ? [...NAME_TYPES, value.type] : NAME_TYPES
  const typeOptions: Option<NameType>[] = types.map((type) => ({
    value: type,
    label: t(`nameType.${type}`),
  }))

  return (
    <div className="flex flex-col gap-3">
      {!shown && (
        <div className="flex items-end gap-1">
          <div className="min-w-0 flex-1">
            <Field label={t('form.nameType')}>
              {(id) => (
                <SelectInput
                  id={id}
                  options={typeOptions}
                  value={value.type || 'birth'}
                  onChange={(type) => set('type', type)}
                />
              )}
            </Field>
          </div>
          <div className="flex">
            {onShow && (
              <IconButton label={t('form.showName')} onClick={onShow}>
                <ArrowUpToLine className="size-4" aria-hidden />
              </IconButton>
            )}
            {onRemove && (
              <IconButton label={t('form.removeName')} onClick={onRemove} danger>
                <Trash className="size-4" aria-hidden />
              </IconButton>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.firstName')} error={error}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={!!error}
              value={value.given}
              onChange={(e) => set('given', e.target.value)}
              autoComplete="off"
              autoFocus={autoFocus}
            />
          )}
        </Field>
        <Field label={t('form.lastName')}>
          {(id) => (
            <TextInput
              id={id}
              value={value.surname}
              onChange={(e) => set('surname', e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'flex size-11 shrink-0 items-center justify-center rounded-full transition',
        'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        danger
          ? 'text-stone-500 hover:bg-red-50 hover:text-red-700'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
