import {
  ChevronDown,
  Monitor,
  Moon,
  Sun,
  FileDown,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ColorMode, ColorVision, Settings } from '../storage/settings'
import { THEMES, type ThemeId } from '../theme/themes'
import { DEFAULT_SIBLING_ORDER, type SiblingOrder } from '../tree/siblingOrder'
import { fullName, peopleCount, type FamilyGraph, type NameOrder } from '../model'
import { LANGUAGES, useT, type Language, type MessageKey } from '../i18n'
import { downloadGedcom } from '../storage/backup'
import { useBackupPicker } from '../storage/useBackupPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'
import { HelpLabel } from '../ui/HelpLabel'

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

const SIBLING_OPTIONS: { value: SiblingOrder; label: MessageKey }[] = [
  { value: 'oldest-first', label: 'siblingOrder.oldest' },
  { value: 'youngest-first', label: 'siblingOrder.youngest' },
  { value: 'boys-first', label: 'siblingOrder.boys' },
  { value: 'girls-first', label: 'siblingOrder.girls' },
]

const NAME_ORDER_OPTIONS: { value: NameOrder; label: MessageKey }[] = [
  { value: 'given-first', label: 'nameOrder.given' },
  { value: 'family-first', label: 'nameOrder.family' },
]

const COLOR_VISION_OPTIONS: { value: ColorVision; label: MessageKey }[] = [
  { value: 'standard', label: 'colorVision.standard' },
  { value: 'protanopia', label: 'colorVision.protanopia' },
  { value: 'deuteranopia', label: 'colorVision.deuteranopia' },
  { value: 'tritanopia', label: 'colorVision.tritanopia' },
  { value: 'monochrome', label: 'colorVision.monochrome' },
]

const COLOR_MODE_OPTIONS: { value: ColorMode; label: MessageKey; icon: LucideIcon }[] = [
  { value: 'system', label: 'colorMode.system', icon: Monitor },
  { value: 'light', label: 'colorMode.light', icon: Sun },
  { value: 'dark', label: 'colorMode.dark', icon: Moon },
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
  const { t } = useT()
  const ref = useRef<HTMLDialogElement>(null)
  /** A tree chosen from a backup file, waiting for the person to confirm replacing theirs. */
  const [imported, setImported] = useState<FamilyGraph | null>(null)
  const picker = useBackupPicker(setImported)
  const [exportError, setExportError] = useState(false)

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
          {t('settings.title')}
        </h2>

        <fieldset className="flex flex-col gap-2.5" aria-labelledby="appearance-label">
          <HelpLabel
            id="appearance-help"
            about={t('settings.appearance')}
            help={t('settings.appearanceHelp')}
            label={
              <span id="appearance-label" className="text-sm font-semibold text-stone-900">
                {t('settings.appearance')}
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
                  {t(label)}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="language-select" className="text-sm font-semibold text-stone-900">
            {t('settings.language')}
          </label>
          <div className="relative">
            <select
              id="language-select"
              value={settings.language}
              onChange={(e) => onChange({ language: e.target.value as Language })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {LANGUAGES.map(({ id, name }) => (
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
        </div>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="theme-select" className="text-sm font-semibold text-stone-900">
            {t('settings.theme')}
          </label>
          <div className="relative">
            <select
              id="theme-select"
              value={settings.theme}
              onChange={(e) => onChange({ theme: e.target.value as ThemeId })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {THEMES.map(({ id }) => (
                <option key={id} value={id}>
                  {t(`theme.${id}.name`)}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500"
              aria-hidden
            />
          </div>
          <ThemePreview id={settings.theme} />
          <p className="text-xs text-stone-500">{t(`theme.${settings.theme}.blurb`)}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <HelpLabel
            id="color-vision-help"
            about={t('settings.colorVision')}
            help={t('settings.colorVisionHelp')}
            label={
              <label htmlFor="color-vision-select" className="text-sm font-semibold text-stone-900">
                {t('settings.colorVision')}
              </label>
            }
          />
          <div className="relative">
            <select
              id="color-vision-select"
              value={settings.colorVision}
              onChange={(e) => onChange({ colorVision: e.target.value as ColorVision })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {COLOR_VISION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                  {value === 'standard' ? t('settings.default') : ''}
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
            id="sibling-order-help"
            about={t('settings.siblingOrder')}
            help={t('settings.siblingOrderHelp')}
            label={
              <label htmlFor="sibling-order-select" className="text-sm font-semibold text-stone-900">
                {t('settings.siblingOrder')}
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
                  {t(label)}
                  {value === DEFAULT_SIBLING_ORDER ? t('settings.default') : ''}
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
            id="name-order-help"
            about={t('settings.nameOrder')}
            help={t('settings.nameOrderHelp')}
            label={
              <label htmlFor="name-order-select" className="text-sm font-semibold text-stone-900">
                {t('settings.nameOrder')}
              </label>
            }
          />
          <div className="relative">
            <select
              id="name-order-select"
              value={settings.nameOrder}
              onChange={(e) => onChange({ nameOrder: e.target.value as NameOrder })}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pr-10 pl-3 text-base text-stone-900 outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
            >
              {NAME_ORDER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                  {value === 'given-first' ? t('settings.default') : ''}
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
            about={t('settings.backup')}
            help={t('settings.backupHelp')}
            label={<span className="text-sm font-semibold text-stone-900">{t('settings.backup')}</span>}
          />
          <Button onClick={picker.open} className="w-full justify-start">
            <Upload className="size-4 text-stone-500" aria-hidden />
            {t('settings.importButton')}
          </Button>
          <Button
            onClick={() => {
              try {
                downloadGedcom(graph)
              } catch {
                setExportError(true)
              }
            }}
            className="w-full justify-start"
          >
            <FileDown className="size-4 text-stone-500" aria-hidden />
            {t('settings.exportGedcom')}
          </Button>
          {picker.input}
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose} autoFocus>
            {t('common.done')}
          </Button>
        </div>
      </div>
    </dialog>

    <ConfirmDialog
      open={imported !== null}
      title={t('import.replaceTitle')}
      confirmLabel={t('import.replaceConfirm')}
      cancelLabel={t('common.cancel')}
      tone="danger"
      onConfirm={() => {
        if (imported) onReplaceTree(imported)
        setImported(null)
        onClose()
      }}
      onCancel={() => setImported(null)}
    >
      {imported && (
        t('import.replaceBody', {
          current: peopleCount(graph),
          name: fullName(imported.people[imported.managerId]),
          imported: peopleCount(imported),
        })
      )}
    </ConfirmDialog>

    <ConfirmDialog
      open={exportError}
      title={t('export.errorTitle')}
      confirmLabel={t('common.ok')}
      onConfirm={() => setExportError(false)}
      onCancel={() => setExportError(false)}
    >
      {t('export.gedcomErrorBody')}
    </ConfirmDialog>

    <ConfirmDialog
      open={picker.error !== null}
      title={t('import.errorTitle')}
      confirmLabel={t('common.ok')}
      onConfirm={picker.clearError}
      onCancel={picker.clearError}
    >
      {picker.error}
    </ConfirmDialog>
    </>
  )
}
