import { Download, FilePlus } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { fullName, peopleCount, type FamilyGraph } from '../model'
import { useT } from '../i18n'
import { downloadBackup } from '../storage/backup'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface HeaderActionsProps {
  graph: FamilyGraph
  /** Removes the saved tree and returns to the start screen. */
  onStartNewTree: () => void
}

/**
 * Export and New tree. Starting a new tree deletes the current one from this
 * device, so it takes two confirmations; the first offers to export a backup.
 */
export function HeaderActions({ graph, onStartNewTree }: HeaderActionsProps) {
  const { t } = useT()
  /** 0 = closed; 1 = "are you sure?"; 2 = the final "delete permanently". */
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [exported, setExported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportBackup = async ({ fromDialog = false } = {}) => {
    try {
      await downloadBackup(graph)
      if (fromDialog) setExported(true)
    } catch {
      setError(t('export.errorBody'))
    }
  }

  const startNewTree = () => {
    setExported(false)
    setStep(1)
  }

  const close = () => {
    setStep(0)
    setExported(false)
  }

  const treeName = t('newTree.treeName', { name: fullName(graph.people[graph.managerId]) })
  const people = peopleCount(graph)

  return (
    <>
      <div className="flex items-center">
        <HeaderButton label={t('header.export')} onClick={() => void exportBackup()} icon={<Download />} />
        <HeaderButton label={t('header.newTree')} onClick={startNewTree} icon={<FilePlus />} />
      </div>

      <ConfirmDialog
        open={step === 1}
        title={t('newTree.title')}
        confirmLabel={t('common.continue')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={exported ? t('newTree.exported') : t('newTree.exportFirst')}
        onSecondary={() => void exportBackup({ fromDialog: true })}
        tone="danger"
        onConfirm={() => setStep(2)}
        onCancel={close}
      >
        {t('newTree.bodyBefore')}
        <strong className="font-semibold text-stone-800">{t('newTree.bodyBold')}</strong>
        {t('newTree.bodyAfter', { tree: treeName, people })}
      </ConfirmDialog>

      <ConfirmDialog
        open={step === 2}
        title={t('newTree.finalTitle')}
        confirmLabel={t('newTree.finalConfirm')}
        cancelLabel={t('newTree.finalCancel')}
        tone="danger"
        onConfirm={() => {
          close()
          onStartNewTree()
        }}
        onCancel={close}
      >
        {t('newTree.finalBody', { tree: treeName, people })}
      </ConfirmDialog>

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
