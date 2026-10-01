import {
  BookOpen,
  Check,
  Download,
  Ellipsis,
  FilePlus,
  LoaderCircle,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fullName, type FamilyGraph } from '../model'
import type { SaveState } from '../storage/autosave'
import { downloadBackup } from '../storage/backup'
import { useBackupPicker } from '../storage/useBackupPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    saving: { icon: <LoaderCircle className="size-3.5 animate-spin" />, text: 'Saving…' },
    saved: { icon: <Check className="size-3.5" />, text: 'Saved' },
    failed: { icon: <TriangleAlert className="size-3.5" />, text: 'Not saved' },
  }[state]
  return (
    <p
      aria-live="polite"
      title={
        state === 'failed'
          ? 'Your browser didn’t let KinGraph save. Export a backup to keep your changes.'
          : 'Saved on this device'
      }
      className={[
        'flex items-center gap-1.5 text-xs font-medium',
        state === 'failed' ? 'text-red-700' : 'text-stone-500',
      ].join(' ')}
    >
      <span aria-hidden>{content.icon}</span>
      {content.text}
    </p>
  )
}

type Pending = { kind: 'import'; graph: FamilyGraph } | { kind: 'new' } | null

interface AppMenuProps {
  graph: FamilyGraph
  /** Whether the browser agreed to keep our data; null if not known yet. */
  persisted: boolean | null
  onReplace: (graph: FamilyGraph) => void
  onStartOver: () => void
  onShowIntro: () => void
}

export function AppMenu({ graph, persisted, onReplace, onStartOver, onShowIntro }: AppMenuProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const picker = useBackupPicker((imported) => setPending({ kind: 'import', graph: imported }))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
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
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-full p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
      >
        <Ellipsis className="size-5" />
      </button>
      {picker.input}

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
          >
            <MenuItem icon={<Download />} onClick={choose(() => downloadBackup(graph))} autoFocus>
              Export backup
            </MenuItem>
            <MenuItem icon={<Upload />} onClick={choose(picker.open)}>
              Import backup
            </MenuItem>
            <MenuItem icon={<FilePlus />} onClick={choose(() => setPending({ kind: 'new' }))}>
              Start a new tree
            </MenuItem>
            <MenuItem icon={<BookOpen />} onClick={choose(onShowIntro)}>
              Show introduction
            </MenuItem>
            <p className="mt-1.5 border-t border-stone-100 px-3 pt-2.5 pb-1.5 text-xs leading-relaxed text-stone-500">
              {persisted === false
                ? 'Saved on this device, but your browser may clear it. Export backups regularly.'
                : 'Saved on this device only. Export a backup to keep a copy elsewhere.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={pending?.kind === 'import'}
        title="Replace your tree?"
        confirmLabel="Replace tree"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          if (pending?.kind === 'import') onReplace(pending.graph)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'import' && (
          <>
            This replaces your current tree ({peopleCount(graph)}) with the imported tree of{' '}
            {fullName(pending.graph.people[pending.graph.managerId])} (
            {peopleCount(pending.graph)}). Export a backup first if you might want your current
            tree back.
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'new'}
        title="Start a new tree?"
        confirmLabel="Remove and start over"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          setPending(null)
          onStartOver()
        }}
        onCancel={() => setPending(null)}
      >
        This removes your current tree from this device and takes you back to the start. Export a
        backup first if you might want it back.
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
    </div>
  )
}

function MenuItem({
  icon,
  onClick,
  autoFocus,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  autoFocus?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      autoFocus={autoFocus}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-stone-800 transition hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none [&_svg]:size-4 [&_svg]:text-stone-500"
    >
      {icon}
      {children}
    </button>
  )
}

function peopleCount(graph: FamilyGraph): string {
  const count = Object.values(graph.people).filter((p) => !p.isPlaceholder).length
  return count === 1 ? '1 person' : `${count} people`
}
