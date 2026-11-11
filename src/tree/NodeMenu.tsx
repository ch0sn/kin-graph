import type { LucideIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { FAN_BOUNCE, FAN_DOT, clamp, discColumn, discHideX, fanDelay, springOf } from './discColumn'

/** One toolbox action drawn as a disc on the fan. */
export interface NodeMenuAction {
  id: string
  label: string
  Icon: LucideIcon
  available: boolean
  tone?: 'default' | 'danger'
  /** Hover and screen-reader text. Longer than `label` when the action can't be used. */
  title: string
  onClick: () => void
}

/** How many springs exist. Hooks cannot be created per action, so this is the ceiling. */
const FAN_SLOTS = 6

/** Delay each disc, then spring it out from behind the card. */
function useFanTravel(open: boolean, count: number, still: boolean): number[] {
  const [lit, setLit] = useState<boolean[]>(() => Array(FAN_SLOTS).fill(false))

  useEffect(() => {
    const timers: number[] = []
    for (let i = 0; i < FAN_SLOTS; i++) {
      const wait = still ? 0 : fanDelay(i, count, open)
      const apply = () =>
        setLit((prev) => {
          const want = open && i < count
          if (prev[i] === want) return prev
          const next = [...prev]
          next[i] = want
          return next
        })
      if (wait <= 0) apply()
      else timers.push(window.setTimeout(apply, wait))
    }
    return () => timers.forEach(clearTimeout)
  }, [open, count, still])

  const targets = lit.map((on) => (on ? 100 : 0))
  const key = targets.join(',')
  const [at, setAt] = useState<number[]>(() => Array(FAN_SLOTS).fill(0))
  const cur = useRef<number[]>(Array(FAN_SLOTS).fill(0))
  const vel = useRef<number[]>(Array(FAN_SLOTS).fill(0))

  useEffect(() => {
    const goal = key.split(',').map(Number)
    if (still) {
      cur.current = goal
      vel.current = goal.map(() => 0)
      return
    }
    const { k, d } = springOf(FAN_BOUNCE)
    let prev = 0
    let raf = 0
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1
      prev = t
      let settled = true
      const next = cur.current.map((value, i) => {
        let v = vel.current[i] + (goal[i] - value) * k * dt
        v *= Math.pow(d, dt)
        let p = value + v * dt
        // Closing discs stop inside the card. A rebound would bring them back out, and the card waits for them.
        if (goal[i] === 0 && p <= 0) {
          vel.current[i] = 0
          return 0
        }
        if (Math.abs(goal[i] - p) < 0.02 && Math.abs(v) < 0.02) {
          vel.current[i] = 0
          return goal[i]
        }
        settled = false
        vel.current[i] = v
        return p
      })
      cur.current = next
      setAt(next)
      if (!settled) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, still])

  // Reduced motion skips the spring and draws the discs where they are going.
  return still ? key.split(',').map(Number) : at
}

/**
 * The person's toolbox. The discs rest in a column off the card's right edge
 * and slide straight out of the card at their own height. Colour comes from
 * the theme, the same surface and ink as settings.
 */
export function NodeFan({
  open,
  actions,
  lineY,
  onFolded,
}: {
  open: boolean
  actions: NodeMenuAction[]
  /** The relationship label's centre, down from the card's top-right corner. */
  lineY: number
  /** Called once the discs have folded away, so the fan can unmount. */
  onFolded?: () => void
}) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const still = reduce === true
  const count = Math.min(actions.length, FAN_SLOTS)
  const travel = useFanTravel(open, count, still)
  const spots = discColumn(count, lineY)
  const hideX = discHideX()
  // Travel starts at 0 while `open` is still true, so this is false until the fan has shut.
  const folded = !open && travel.every((v) => v === 0)

  useEffect(() => {
    if (folded) onFolded?.()
  }, [folded, onFolded])

  if (count === 0) return null

  return (
    <div className="node-fan" role="toolbar" aria-label={t('sheet.tools')}>
      {actions.slice(0, count).map((action, i) => {
        const u = clamp(travel[i] / 100, 0, 1.4)
        const spot = spots[i]
        const x = hideX + (spot.x - hideX) * u
        const y = spot.y
        return (
          <button
            key={action.id}
            type="button"
            className="node-act nodrag nopan"
            data-tone={action.tone === 'danger' ? 'danger' : undefined}
            aria-label={action.title}
            title={action.title}
            aria-disabled={!action.available || undefined}
            tabIndex={open ? 0 : -1}
            style={
              {
                width: FAN_DOT,
                height: FAN_DOT,
                marginTop: -FAN_DOT / 2,
                marginLeft: -FAN_DOT / 2,
                translate: `${x}px ${y}px`,
                '--pop': 0.82 + 0.18 * Math.min(u, 1),
                '--lx': `${spot.nx * 30}px`,
                '--ly': `${spot.ny * 30}px`,
                pointerEvents: open && u > 0.45 ? 'auto' : 'none',
              } as React.CSSProperties
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (action.available) action.onClick()
            }}
          >
            <action.Icon size={16} strokeWidth={2} aria-hidden />
            <span className="node-act-label">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
