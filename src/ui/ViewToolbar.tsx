import type { ReactNode } from 'react'

/**
 * A view's controls in a narrow box hanging from the header: icons only,
 * widening to the left on hover or focus to show what each does.
 */
export function ViewToolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      // Flush with the window's right edge. 57px less the padding and left border leaves 40px: a 20px icon with 10px either side.
      className="group/view flex w-[57px] flex-col gap-1 overflow-hidden rounded-bl-2xl border border-t-0 border-r-0 border-stone-200 bg-white/80 p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur transition-[width] duration-200 ease-out focus-within:w-48 hover:w-48 motion-reduce:transition-none"
    >
      {children}
    </div>
  )
}

export function ViewButton({
  label,
  hint = label,
  ariaLabel = label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  /** The tooltip, when it should say more than the label. */
  hint?: string
  ariaLabel?: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={hint}
      disabled={disabled}
      onClick={onClick}
      className={[
        // Reversed so the icon stays at the right edge while the box widens to the left.
        'flex w-full flex-row-reverse items-center gap-3 rounded-xl px-2.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        pressed ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
      ].join(' ')}
    >
      <span className="flex w-5 shrink-0 justify-center">{children}</span>
      <span className="opacity-0 transition-opacity duration-150 group-focus-within/view:opacity-100 group-hover/view:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </button>
  )
}

export function ViewDivider() {
  return <hr className="mx-1 my-0.5 border-stone-200" />
}
