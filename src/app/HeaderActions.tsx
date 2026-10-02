import { Download, FilePlus } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { fullName, peopleCount, type FamilyGraph } from '../model'
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
  /** 0 = closed; 1 = "are you sure?"; 2 = the final "delete permanently". */
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [exported, setExported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportBackup = async ({ fromDialog = false } = {}) => {
    try {
      await downloadBackup(graph)
      if (fromDialog) setExported(true)
    } catch {
      setError('The backup couldn’t be created. Please try again.')
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

  const treeName = `${fullName(graph.people[graph.managerId])}’s tree`

  return (
    <>
      <div className="flex items-center">
        <HeaderButton label="Export" onClick={() => void exportBackup()} icon={<Download />} />
        <HeaderButton label="New tree" onClick={startNewTree} icon={<FilePlus />} />
      </div>

      <ConfirmDialog
        open={step === 1}
        title="Start a new tree?"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        secondaryLabel={exported ? 'Backup exported ✓' : 'Export backup first'}
        onSecondary={() => void exportBackup({ fromDialog: true })}
        tone="danger"
        onConfirm={() => setStep(2)}
        onCancel={close}
      >
        Starting a new tree <strong className="font-semibold text-stone-800">deletes your current
        tree</strong> ({treeName}, {peopleCount(graph)}) from this device. Export a backup first if
        you might want it back.
      </ConfirmDialog>

      <ConfirmDialog
        open={step === 2}
        title="Delete this tree for good?"
        confirmLabel="Delete and start new"
        cancelLabel="No, keep it"
        tone="danger"
        onConfirm={() => {
          close()
          onStartNewTree()
        }}
        onCancel={close}
      >
        This is your last chance: {treeName} ({peopleCount(graph)}, with their photos) will be
        permanently deleted and can’t be restored unless you exported a backup.
      </ConfirmDialog>

      <ConfirmDialog
        open={error !== null}
        title="Couldn’t export a backup"
        confirmLabel="OK"
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
