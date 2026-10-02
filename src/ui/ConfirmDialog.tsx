import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './fields'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** Omit for a message that only needs acknowledging. */
  cancelLabel?: string
  /** An extra action between Cancel and the confirm button, e.g. "Export backup first". */
  secondaryLabel?: string
  onSecondary?: () => void
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal question built on the native <dialog>, which traps focus, closes
 * on Escape and dims the page behind it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  secondaryLabel,
  onSecondary,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget) onCancel()
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_160ms_ease-out]"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id="confirm-dialog-title" className="font-serif text-xl leading-tight">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-stone-600">{children}</div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {/* For destructive actions, Enter shouldn't confirm by accident. */}
          {cancelLabel && (
            <Button variant="ghost" onClick={onCancel} autoFocus={tone === 'danger'}>
              {cancelLabel}
            </Button>
          )}
          {secondaryLabel && (
            <Button variant="secondary" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            autoFocus={tone !== 'danger' || !cancelLabel}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
