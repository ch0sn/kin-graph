import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { FAN_BOUNCE, FAN_DOT, clamp, fanDelay, fanSpots, hidePoint, springOf } from './cornerFan'
import type { NodeMenuAction } from './useNodeMenu'

/** How many springs exist. Hooks cannot be created per action, so this is the ceiling. */
const FAN_SLOTS = 6

/** Delay each disc, then spring it from under the corner out to its place. */
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
 * The person's toolbox, folded into the card's top-right corner until the
 * card is the one that was clicked. Light discs, hairline stroke: the
 * action-node demo at theme=dark, fill=light, stroke=on.
 */
export function NodeFan({
  open,
  actions,
  corner,
  onInvoke,
  onFolded,
}: {
  open: boolean
  actions: NodeMenuAction[]
  corner: number
  onInvoke: (id: string) => void
  onFolded: () => void
}) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const still = reduce === true
  const count = Math.min(actions.length, FAN_SLOTS)
  const travel = useFanTravel(open, count, still)
  const spots = fanSpots(count, corner)
  const hid = hidePoint(clamp(corner, 0, 40))
  // Travel starts at 0 while `open` is still true, so this is false until the fan has shut.
  const folded = !open && travel.every((v) => v === 0)

  useEffect(() => {
    if (folded) onFolded()
  }, [folded, onFolded])

  if (count === 0) return null

  return (
    <div className="node-fan" role="toolbar" aria-label={t('sheet.tools')}>
      {actions.slice(0, count).map((action, i) => {
        const u = clamp(travel[i] / 100, 0, 1.4)
        const spot = spots[i]
        const x = hid.x + (spot.x - hid.x) * u
        const y = hid.y + (spot.y - hid.y) * u
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
                pointerEvents: u > 0.45 ? 'auto' : 'none',
              } as React.CSSProperties
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onInvoke(action.id)
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
