import { Redo2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { useT } from '../i18n'
import { isMac } from './useUndoShortcuts'

/** Undo and redo buttons for the tree on show. */
export function UndoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}) {
  const { t } = useT()
  const key = isMac ? '⌘' : 'Ctrl+'
  return (
    <div className="flex items-center">
      <IconButton label={t('edit.undo')} shortcut={`${key}Z`} disabled={!canUndo} onClick={onUndo}>
        <Undo2 />
      </IconButton>
      <IconButton label={t('edit.redo')} shortcut={`${key}⇧Z`} disabled={!canRedo} onClick={onRedo}>
        <Redo2 />
      </IconButton>
    </div>
  )
}

function IconButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={`${label} (${shortcut})`}
      aria-label={label}
      aria-keyshortcuts={isMac ? 'Meta+Z' : 'Control+Z'}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[18px]"
    >
      {children}
    </button>
  )
}

export interface Notice {
  /** Changes for each new notice, so the same text shown twice restarts the timer. */
  id: number
  text: string
  onUndo?: () => void
}

/** A short message about an edit, with a way to take it back, that goes away by itself. */
export function UndoToast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const { t } = useT()
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(onDismiss, 7000)
    return () => clearTimeout(timer)
  }, [notice, onDismiss])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-stone-900 py-1.5 pr-1.5 pl-4 text-sm text-stone-50 shadow-xl"
          >
            <span className="truncate">{notice.text}</span>
            {notice.onUndo && (
              <button
                type="button"
                onClick={() => {
                  notice.onUndo?.()
                  onDismiss()
                }}
                className="shrink-0 rounded-full px-3 py-1 font-semibold underline-offset-2 transition hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {t('edit.undo')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
