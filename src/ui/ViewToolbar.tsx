import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'

/** How long a click keeps the rail open before it folds shut. */
const CLICK_HOLD_MS = 3000

/**
 * A view's controls in a narrow box hanging from the header: icons only,
 * widening to the left on hover or keyboard focus to show what each does.
 * A click holds it open briefly, then folds it so it does not stay open.
 */
export function ViewToolbar({ label, children }: { label: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const [held, setHeld] = useState(false)
  // After the click hold, ignore hover until the pointer leaves. Otherwise the rail would pop straight back open.
  const [resting, setResting] = useState(false)
  const hoveredRef = useRef(false)
  const holdTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(holdTimer.current), [])

  const expanded = keyboard || held || (hovered && !resting)

  const onPointerEnter = () => {
    const cameFromOutside = !hoveredRef.current
    hoveredRef.current = true
    setHovered(true)
    if (cameFromOutside) setResting(false)
  }

  const onPointerLeave = () => {
    hoveredRef.current = false
    setHovered(false)
    setResting(false)
    window.clearTimeout(holdTimer.current)
    setHeld(false)
  }

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof Element) || !target.closest('button')) return
    // Enter and Space report detail 0. Keyboard focus keeps the rail open on its own.
    if (event.detail === 0) return
    window.clearTimeout(holdTimer.current)
    setKeyboard(false)
    setResting(false)
    setHeld(true)
    holdTimer.current = window.setTimeout(() => {
      setHeld(false)
      if (hoveredRef.current) setResting(true)
    }, CLICK_HOLD_MS)
  }

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.matches(':focus-visible')) setKeyboard(true)
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Element && event.currentTarget.contains(next) && next.matches(':focus-visible')) return
    setKeyboard(false)
  }

  return (
    <div
      role="toolbar"
      aria-label={label}
      data-open={expanded ? 'true' : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      // Flush with the window's right edge. 57px less the padding and left border leaves 40px: a 20px icon with 10px either side.
      className="group/view flex w-[57px] flex-col gap-1 overflow-hidden rounded-bl-2xl border border-t-0 border-r-0 border-stone-200 bg-white/80 p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur transition-[width] duration-200 ease-out data-[open=true]:w-48 motion-reduce:transition-none"
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
        'flex w-full flex-row-reverse items-center gap-3 rounded-xl px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        pressed ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
      ].join(' ')}
    >
      <span className="flex w-5 shrink-0 justify-center">{children}</span>
      <span className="opacity-0 transition-opacity duration-150 group-data-[open=true]/view:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </button>
  )
}

export function ViewDivider() {
  return <hr className="mx-1 my-0.5 border-stone-200" />
}
