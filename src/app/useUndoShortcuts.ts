import { useEffect } from 'react'

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z (or Ctrl+Y) redoes, except while
 * typing, where they undo the typing, or while a dialog is open.
 */
export function useUndoShortcuts(onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const redo = (key === 'z' && e.shiftKey) || (key === 'y' && !isMac)
      if (key !== 'z' && !redo) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      if (redo) onRedo()
      else onUndo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onUndo, onRedo])
}
