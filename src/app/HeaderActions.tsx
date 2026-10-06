import { Download } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { FamilyGraph } from '../model'
import { useT } from '../i18n'
import { downloadBackup, downloadGedcom } from '../storage/backup'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/** Export, for the tree on show; nothing while starting one or with no tab open. */
export function HeaderActions({ graph }: { graph: FamilyGraph | null }) {
  const { t } = useT()
  const [error, setError] = useState<string | null>(null)
  if (!graph) return null

  const exportBackup = async () => {
    try {
      await downloadBackup(graph)
    } catch {
      setError(t('export.errorBody'))
    }
  }

  const exportGedcom = () => {
    try {
      downloadGedcom(graph)
    } catch {
      setError(t('export.gedcomErrorBody'))
    }
  }

  return (
    <>
      <ExportMenu onBackup={() => void exportBackup()} onGedcom={exportGedcom} />
      <ConfirmDialog
        open={error !== null}
        title={t('export.errorTitle')}
        confirmLabel={t('common.ok')}
        onConfirm={() => setError(null)}
        onCancel={() => setError(null)}
      >
        {error}
      </ConfirmDialog>
    </>
  )
}

/** An icon button that shows its label beside the icon on wider screens. */
function HeaderButton({
  label,
  icon,
  ...props
}: { label: string; icon: ReactNode } & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex items-center gap-1.5 rounded-full p-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none sm:px-3 [&_svg]:size-[18px]"
      {...props}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** The header's Export button, which asks which format to save the tree in. */
function ExportMenu({ onBackup, onGedcom }: { onBackup: () => void; onGedcom: () => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative">
      <HeaderButton
        label={t('header.export')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        icon={<Download />}
      />
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
        >
          <FormatItem title={t('export.backup')} hint={t('export.backupHint')} onClick={choose(onBackup)} />
          <FormatItem title={t('export.gedcom')} hint={t('export.gedcomHint')} onClick={choose(onGedcom)} />
        </div>
      )}
    </div>
  )
}

function FormatItem({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none"
    >
      <span className="text-sm text-stone-800">{title}</span>
      <span className="text-xs text-stone-500">{hint}</span>
    </button>
  )
}
