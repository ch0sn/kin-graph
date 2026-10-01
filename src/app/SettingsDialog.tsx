import {
  ChartNoAxesColumnDecreasing,
  ChartNoAxesColumnIncreasing,
  Mars,
  Venus,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Settings } from '../storage/settings'
import { DEFAULT_SIBLING_ORDER, type SiblingOrder } from '../tree/siblingOrder'
import { Button } from '../ui/fields'

const SIBLING_OPTIONS: { value: SiblingOrder; label: string; hint: string; icon: LucideIcon }[] = [
  {
    value: 'oldest-first',
    label: 'Oldest to youngest',
    hint: 'The way family trees are usually read.',
    icon: ChartNoAxesColumnDecreasing,
  },
  {
    value: 'youngest-first',
    label: 'Youngest to oldest',
    hint: 'The newest arrivals come first.',
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    value: 'boys-first',
    label: 'Boys first',
    hint: 'Then girls, each oldest to youngest.',
    icon: Mars,
  },
  {
    value: 'girls-first',
    label: 'Girls first',
    hint: 'Then boys, each oldest to youngest.',
    icon: Venus,
  },
]

interface SettingsDialogProps {
  open: boolean
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

/** Display preferences. Changes apply straight away, so the tree rearranges behind it. */
export function SettingsDialog({ open, settings, onChange, onClose }: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="settings-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-900/20 open:animate-[dialog-in_160ms_ease-out]"
    >
      <div className="flex flex-col gap-5 p-6">
        <h2 id="settings-title" className="font-serif text-2xl leading-tight">
          Settings
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-stone-900">Sibling order</legend>
          <p className="-mt-0.5 mb-1.5 text-sm text-stone-500">
            How brothers and sisters line up, left to right.
          </p>
          {SIBLING_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const checked = settings.siblingOrder === value
            return (
              <label
                key={value}
                className={[
                  'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition',
                  'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-stone-200',
                  checked
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="sibling-order"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onChange({ siblingOrder: value })}
                />
                <span
                  className={[
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    checked ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500',
                  ].join(' ')}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
                    {label}
                    {value === DEFAULT_SIBLING_ORDER && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-stone-500">{hint}</span>
                </span>
              </label>
            )
          })}
          <p className="mt-1 text-xs text-stone-500">
            People without a birth date, or without a gender when grouping by gender, are placed
            last.
          </p>
        </fieldset>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose} autoFocus>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  )
}
