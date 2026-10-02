import {
  ChevronDown,
  CircleQuestionMark,
  Monitor,
  Moon,
  Sun,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ColorMode, Settings } from '../storage/settings'
import { THEMES, themeInfo, type ThemeId } from '../theme/themes'
import { DEFAULT_SIBLING_ORDER, type SiblingOrder } from '../tree/siblingOrder'
import { fullName, peopleCount, type FamilyGraph } from '../model'
import { useBackupPicker } from '../storage/useBackupPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'

/** A miniature tree drawn in a theme's own colours, shape and typeface. */
function ThemePreview({ id }: { id: ThemeId }) {
  return (
    <div
      data-theme={id}
      aria-hidden
      className="relative flex h-24 items-center justify-center gap-5 overflow-hidden rounded-xl bg-stone-50 px-2"
    >
      <span className="absolute top-1/2 right-9 left-9 h-px bg-stone-300" style={{ height: 'var(--edge-w)' }} />
      <PreviewCard name="Ana" highlight />
      <PreviewCard name="Leo" />
    </div>
  )
}

function PreviewCard({ name, highlight = false }: { name: string; highlight?: boolean }) {
  return (
    <span
      className={[
        'relative flex items-center gap-1.5 border bg-white px-1.5 py-1.5 card-shadow',
        highlight ? 'border-(--accent)' : 'border-stone-200',
      ].join(' ')}
      style={{ borderRadius: 'min(var(--card-radius), 18px)' }}
    >
      <span
        className={[
          'flex size-5 items-center justify-center rounded-full text-[9px] font-serif',
          highlight ? 'bg-(--accent-soft) text-(--accent-ink)' : 'bg-stone-100 text-stone-600',
        ].join(' ')}
      >
        {name[0]}
      </span>
      <span className="pr-1 font-serif text-[length:var(--name-size)] leading-none text-stone-900">{name}</span>
    </span>
  )
}

/** A label followed by a "?" icon that explains it in a one-line tooltip on hover or focus. */
function HelpLabel({
  label,
  about,
  help,
  id,
}: {
  label: ReactNode
  /** What the icon explains, for screen readers: "About <about>". */
  about: string
  help: string
  id: string
}) {
  return (
    <div className="relative flex items-center gap-1.5">
      {label}
      <span className="group flex">
        <button
          type="button"
          aria-label={`About ${about}`}
          aria-describedby={id}
          className="rounded-full text-stone-400 transition hover:text-stone-700 focus-visible:text-stone-700 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
        >
          <CircleQuestionMark className="size-4" aria-hidden />
        </button>
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-max max-w-full rounded-lg bg-stone-900 px-3 py-2 text-xs leading-snug whitespace-nowrap text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {help}
        </span>
      </span>
    </div>
  )
}

const SIBLING_OPTIONS: { value: SiblingOrder; label: string }[] = [
  {
    value: 'oldest-first',
    label: 'Oldest to youngest',
  },
  {
    value: 'youngest-first',
    label: 'Youngest to oldest',
  },
  {
    value: 'boys-first',
    label: 'Boys first',
  },
  {
    value: 'girls-first',
    label: 'Girls first',
  },
]

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

interface SettingsDialogProps {
  open: boolean
  graph: FamilyGraph
  /** Replaces the tree with one imported from a backup file. */
  onReplaceTree: (graph: FamilyGraph) => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

/** Display preferences. Changes apply straight away, so the tree rearranges behind it. */
export function SettingsDialog({
  open,
  graph,
  onReplaceTree,
  settings,
  onChange,
  onClose,
}: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  /** A tree chosen from a backup file, waiting for the person to confirm replacing theirs. */
  const [imported, setImported] = useState<FamilyGraph | null>(null)
  const picker = useBackupPicker(setImported)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
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
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/20 open:animate-[dialog-in_160ms_ease-out]"
    >
      <div className="flex max-h-[85dvh] flex-col gap-6 overflow-y-auto p-6">
        <h2 id="settings-title" className="font-serif text-2xl leading-tight">
          Settings
        </h2>

        <fieldset className="flex flex-col gap-2.5" aria-labelledby="appearance-label">
          <HelpLabel
            id="appearance-help"
            about="appearance"
            help="System follows your phone or computer’s light or dark setting."
            label={
              <span id="appearance-label" className="text-sm font-semibold text-stone-900">
                Appearance
              </span>
            }
          />
          <div className="grid grid-cols-3 gap-2">
            {COLOR_MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
              const checked = settings.colorMode === value
              return (
                <label
                  key={value}
                  className={[
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-sm font-medium transition',
                    'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-stone-200',
                    checked
                      ? 'border-stone-900 bg-stone-50 text-stone-900'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="color-mode"
                    className="sr-only"
                    checked={checked}
                    onChange={() => onChange({ colorMode: value })}
                  />
                  <Icon className="size-5" aria-hidden />
                  {label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="theme-select" className="text-sm font-semibold text-stone-900">
            Theme
          </label>
          <div className="relative">
            <select
              id="theme-select"
              value={settings.theme}
              onChange={(e) => onChange({ theme: e.target.value as ThemeId })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {THEMES.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500"
              aria-hidden
            />
          </div>
          <ThemePreview id={settings.theme} />
          <p className="text-xs text-stone-500">{themeInfo(settings.theme).blurb}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <HelpLabel
            id="sibling-order-help"
            about="sibling order"
            help="How brothers and sisters line up, left to right."
            label={
              <label htmlFor="sibling-order-select" className="text-sm font-semibold text-stone-900">
                Sibling order
              </label>
            }
          />
          <div className="relative">
            <select
              id="sibling-order-select"
              value={settings.siblingOrder}
              onChange={(e) => onChange({ siblingOrder: e.target.value as SiblingOrder })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {SIBLING_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                  {value === DEFAULT_SIBLING_ORDER ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500"
              aria-hidden
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <HelpLabel
            id="import-help"
            about="importing a backup"
            help="Replace your tree with one from a KinGraph backup file (.json)."
            label={<span className="text-sm font-semibold text-stone-900">Backup</span>}
          />
          <Button onClick={picker.open} className="w-full justify-start">
            <Upload className="size-4 text-stone-500" aria-hidden />
            Import backup…
          </Button>
          {picker.input}
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose} autoFocus>
            Done
          </Button>
        </div>
      </div>
    </dialog>

    <ConfirmDialog
      open={imported !== null}
      title="Replace your tree?"
      confirmLabel="Replace tree"
      cancelLabel="Cancel"
      tone="danger"
      onConfirm={() => {
        if (imported) onReplaceTree(imported)
        setImported(null)
        onClose()
      }}
      onCancel={() => setImported(null)}
    >
      {imported && (
        <>
          This replaces your current tree ({peopleCount(graph)}) with the imported tree of{' '}
          {fullName(imported.people[imported.managerId])} ({peopleCount(imported)}). Export a
          backup first if you might want your current tree back.
        </>
      )}
    </ConfirmDialog>

    <ConfirmDialog
      open={picker.error !== null}
      title="Couldn’t import that file"
      confirmLabel="OK"
      onConfirm={picker.clearError}
      onCancel={picker.clearError}
    >
      {picker.error}
    </ConfirmDialog>
    </>
  )
}
