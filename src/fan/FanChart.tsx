import { ChevronLeft, Expand, LocateFixed, Minus, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import {
  displayName,
  fullName,
  initials,
  lifeYears,
  relationshipLabel,
  type FamilyGraph,
  type Person,
  type PersonId,
} from '../model'
import { MAX_FAN_GENERATIONS, MIN_FAN_GENERATIONS } from '../storage/settings'
import { ViewButton, ViewDivider, ViewToolbar } from '../ui/ViewToolbar'
import {
  CENTRE_RADIUS,
  fitLabel,
  labelRoom,
  nameSize,
  polar,
  ringRadii,
  sectorPath,
  slotAngles,
  textWidth,
} from './geometry'
import { ancestorCounts, generationOf, pedigree } from './pedigree'
import { usePanZoom } from './usePanZoom'

interface FanChartProps {
  graph: FamilyGraph
  /** How many generations of ancestors to show. */
  generations: number
  onGenerationsChange: (generations: number) => void
  selectedId: PersonId | null
  onSelect: (id: PersonId | null) => void
  /** Asks to add a parent for `childId`, from an empty slot. */
  onAddParent: (childId: PersonId) => void
  /** Where the view controls are drawn, outside the canvas; none are shown until it exists. */
  controlsSlot: HTMLElement | null
}

/** How strongly each generation is tinted with its side's colour, the parents most. */
const TINTS = [0, 55, 42, 32, 24, 18, 14, 11]
/** Space around the fan, and below its baseline for the ring and side names. */
const PADDING = 24
const BELOW = 56
/** How long a touch must be held to centre the fan on someone. */
const LONG_PRESS_MS = 550

const tint = (side: 'father' | 'mother', generation: number) =>
  `color-mix(in oklab, var(--fan-${side}) ${TINTS[generation] ?? 10}%, var(--color-white))`

/**
 * A person's direct ancestors as a half-circle fan: parents in the first ring,
 * grandparents in the next, the father's side on the left. Unknown ancestors
 * are dashed slots; clicking one next to a known person adds that parent.
 * Double-clicking (or long-pressing) someone centres the fan on them.
 */
export function FanChart({
  graph,
  generations,
  onGenerationsChange,
  selectedId,
  onSelect,
  onAddParent,
  controlsSlot,
}: FanChartProps) {
  const { t } = useT()
  const [centreId, setCentreId] = useState<PersonId>(graph.managerId)
  /** Who the fan was centred on before, oldest first, for stepping back. */
  const [trail, setTrail] = useState<PersonId[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const { view, reset, wasDrag, handlers } = usePanZoom(svgRef)
  /** The slot under the pointer or keyboard focus, outlined above its neighbours. */
  const [litIndex, setLitIndex] = useState<number | null>(null)
  const pressTimer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  // People may be removed while the fan is centred on them or passed through them.
  const centre = graph.people[centreId] ? centreId : graph.managerId
  const shownTrail = trail.filter((id) => graph.people[id] && id !== centre)

  const fan = useMemo(() => pedigree(graph, centre, generations), [graph, centre, generations])
  const radii = useMemo(() => ringRadii(generations), [generations])
  const outer = radii[generations + 1]
  const counts = ancestorCounts(fan)

  const recentre = (id: PersonId) => {
    if (id === centre) return
    setTrail([...shownTrail, centre])
    setCentreId(id)
    reset()
  }
  const jumpBack = (to: number) => {
    setCentreId(shownTrail[to])
    setTrail(shownTrail.slice(0, to))
    reset()
  }
  const home = () => {
    setCentreId(graph.managerId)
    setTrail([])
    reset()
  }

  const startPress = (e: PointerEvent, id: PersonId) => {
    longPressed.current = false
    window.clearTimeout(pressTimer.current)
    if (e.pointerType !== 'touch') return
    pressTimer.current = window.setTimeout(() => {
      if (wasDrag()) return
      longPressed.current = true
      recentre(id)
    }, LONG_PRESS_MS)
  }
  const endPress = () => window.clearTimeout(pressTimer.current)
  /** A click that wasn't really one: the end of a drag or of a long press. */
  const notAClick = () => wasDrag() || longPressed.current

  const personKeys = (id: PersonId) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (e.shiftKey) recentre(id)
    else onSelect(id)
  }

  const timesShown = useMemo(() => {
    const times = new Map<PersonId, number>()
    for (const id of fan.slots) if (id) times.set(id, (times.get(id) ?? 0) + 1)
    return times
  }, [fan])

  const slots = []
  const selectedOutlines = []
  let litOutline = null
  const lightUp = (index: number) => ({
    onPointerEnter: () => setLitIndex(index),
    onPointerLeave: () => setLitIndex((lit) => (lit === index ? null : lit)),
    onFocus: () => setLitIndex(index),
    onBlur: () => setLitIndex((lit) => (lit === index ? null : lit)),
  })
  for (let index = 2; index < fan.slots.length; index++) {
    const generation = generationOf(index)
    const { a0, a1 } = slotAngles(index)
    const r0 = radii[generation]
    const r1 = radii[generation + 1]
    const d = sectorPath(r0, r1, a0, a1)
    const id = fan.slots[index]
    const fathersSide = index - 2 ** generation < 2 ** (generation - 1)
    const childId = fan.slots[index >> 1]
    if (index === litIndex && (id || childId)) {
      litOutline = <path d={d} className="pointer-events-none fill-none stroke-(--accent) stroke-[2.5]" />
    }

    if (!id) {
      const child = childId ? graph.people[childId] : null
      const title = child && t(fathersSide ? 'fan.addFather' : 'fan.addMother', { name: fullName(child) })
      slots.push(
        <g
          key={index}
          role={child ? 'button' : undefined}
          tabIndex={child ? 0 : undefined}
          aria-label={title || undefined}
          className={child ? 'group cursor-pointer outline-none' : 'opacity-50'}
          {...(child && lightUp(index))}
          onClick={() => childId && !notAClick() && onAddParent(childId)}
          onKeyDown={(e) => {
            if (childId && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onAddParent(childId)
            }
          }}
        >
          {title && <title>{title}</title>}
          <path
            d={d}
            className="fill-white stroke-stone-300 stroke-[1.5] [stroke-dasharray:5_4]"
          />
          {child && <EmptyLabel generation={generation} r0={r0} r1={r1} a0={a0} a1={a1} label={t('fan.add')} />}
        </g>,
      )
      continue
    }

    const person = graph.people[id]
    const relation = relationshipLabel(graph, id, centre)
    const years = lifeYears(person)
    const repeated = (timesShown.get(id) ?? 0) > 1
    const tooltip = [fullName(person), years, relation, repeated && t('fan.repeated'), t('fan.hint')]
      .filter(Boolean)
      .join('\n')
    slots.push(
      <g
        key={index}
        role="button"
        tabIndex={0}
        aria-label={[fullName(person), years, relation].filter(Boolean).join(', ')}
        aria-pressed={id === selectedId}
        className="group cursor-pointer outline-none"
        onClick={() => !notAClick() && onSelect(id)}
        onDoubleClick={() => recentre(id)}
        onPointerDown={(e) => startPress(e, id)}
        onKeyDown={personKeys(id)}
        {...lightUp(index)}
      >
        <title>{tooltip}</title>
        <path
          d={d}
          style={{ fill: tint(fathersSide ? 'father' : 'mother', generation) }}
          className="stroke-stone-50 stroke-3"
        />
        <PersonLabel person={person} generation={generation} r0={r0} r1={r1} a0={a0} a1={a1} />
        {repeated && generation <= 4 && <RepeatBadge r1={r1} angle={(a0 + a1) / 2} times={timesShown.get(id)!} />}
      </g>,
    )
    if (id === selectedId) {
      selectedOutlines.push(
        <path key={index} d={d} className="pointer-events-none fill-none stroke-(--accent) stroke-[3.5]" />,
      )
    }
  }

  const centrePerson = graph.people[centre]
  const centreYears = lifeYears(centrePerson)
  const viewBox = `${-outer - PADDING} ${-outer - PADDING} ${2 * (outer + PADDING)} ${outer + PADDING + BELOW}`

  return (
    <div
      className={[
        'relative size-full overflow-hidden transition-[padding] duration-300 ease-out motion-reduce:transition-none',
        // Make room for the person sheet: beside it (with its toolbox) on wide screens, above it on phones.
        selectedId ? 'pb-[50dvh] sm:pb-0 sm:pl-[min(34rem,55%)]' : '',
      ].join(' ')}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={t('fan.label', { name: fullName(centrePerson) })}
        className="size-full touch-none select-none"
        onClick={(e) => e.target === e.currentTarget && !wasDrag() && onSelect(null)}
        {...handlers}
        onPointerUp={(e) => {
          handlers.onPointerUp(e)
          endPress()
        }}
        onPointerCancel={(e) => {
          handlers.onPointerCancel(e)
          endPress()
        }}
        onPointerLeave={endPress}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* Keyed by the centre person, so re-centring grows the new fan into place. */}
          <motion.g
            key={centre}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ originX: 0.5, originY: 1 }}
          >
            {slots}
            <g
              role="button"
              tabIndex={0}
              aria-label={[fullName(centrePerson), centreYears].filter(Boolean).join(', ')}
              aria-pressed={centre === selectedId}
              className="group cursor-pointer outline-none"
              onClick={() => !notAClick() && onSelect(centre)}
              onKeyDown={personKeys(centre)}
            >
              <title>{[fullName(centrePerson), centreYears].filter(Boolean).join('\n')}</title>
              <path
                d={sectorPath(0, CENTRE_RADIUS, 180, 0)}
                style={{ fill: 'var(--accent-soft)' }}
                className="stroke-(--accent) stroke-[2.5] group-focus-visible:stroke-4"
              />
              <text y={-CENTRE_RADIUS * 0.42} textAnchor="middle" className="pointer-events-none">
                <tspan x={0} className="fill-stone-900 font-serif font-semibold" style={{ fontSize: 15 }}>
                  {fitLabel(2 * CENTRE_RADIUS - 24, 15, fullName(centrePerson), firstName(centrePerson), '') ===
                  'full'
                    ? fullName(centrePerson)
                    : firstName(centrePerson)}
                </tspan>
                {centreYears && (
                  <tspan x={0} dy="1.4em" className="fill-stone-600" style={{ fontSize: 11 }}>
                    {centreYears}
                  </tspan>
                )}
              </text>
            </g>
            {selectedOutlines}
            {litOutline}
            {centre === selectedId && (
              <path
                d={sectorPath(0, CENTRE_RADIUS, 180, 0)}
                className="pointer-events-none fill-none stroke-(--accent) stroke-[3.5]"
              />
            )}
            <Baseline radii={radii} generations={generations} outer={outer} />
          </motion.g>
        </g>
      </svg>

      <div className="pointer-events-none absolute top-16 left-3 flex flex-col items-start gap-2">
        {shownTrail.length > 0 && (
          <nav
            aria-label={t('fan.centredOn')}
            className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white/90 p-1 text-sm shadow-sm backdrop-blur"
          >
            <button
              type="button"
              aria-label={t('fan.back')}
              title={t('fan.back')}
              onClick={() => jumpBack(shownTrail.length - 1)}
              className="rounded-lg p-1.5 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            {shownTrail.map((id, i) => (
              <span key={id} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => jumpBack(i)}
                  className="rounded-lg px-1.5 py-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
                >
                  {fullName(graph.people[id])}
                </button>
                <span aria-hidden className="text-stone-300">
                  ›
                </span>
              </span>
            ))}
            <span aria-current="page" className="shrink-0 px-1.5 py-1 font-medium text-stone-900">
              {fullName(centrePerson)}
            </span>
          </nav>
        )}
        <p className="flex items-center gap-2 rounded-lg bg-stone-50/80 px-1 text-xs text-stone-500">
          <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-stone-200">
            <span
              className="block h-full rounded-full bg-(--accent)"
              style={{ width: `${(counts.known / counts.total) * 100}%` }}
            />
          </span>
          {t('fan.found', { known: counts.known, total: counts.total })}
        </p>
      </div>

      {controlsSlot &&
        createPortal(
          <ViewToolbar label={t('fan.view')}>
            <ViewButton label={t('fan.home')} onClick={home}>
              <LocateFixed className="size-5" aria-hidden />
            </ViewButton>
            <ViewButton label={t('fan.whole')} onClick={reset}>
              <Expand className="size-5" aria-hidden />
            </ViewButton>
            <ViewDivider />
            <ViewButton
              label={t('fan.more')}
              disabled={generations >= MAX_FAN_GENERATIONS}
              onClick={() => onGenerationsChange(generations + 1)}
            >
              <Plus className="size-5" aria-hidden />
            </ViewButton>
            <ViewButton
              label={t('fan.fewer')}
              disabled={generations <= MIN_FAN_GENERATIONS}
              onClick={() => onGenerationsChange(generations - 1)}
            >
              <Minus className="size-5" aria-hidden />
            </ViewButton>
          </ViewToolbar>,
          controlsSlot,
        )}
    </div>
  )
}

function firstName(person: Person): string {
  return displayName(person).given.trim().split(/\s+/)[0] || fullName(person)
}

interface SlotGeometry {
  generation: number
  r0: number
  r1: number
  a0: number
  a1: number
}

/** As much of the name as fits, with the years underneath in the inner rings. */
function PersonLabel({ person, generation, r0, r1, a0, a1 }: SlotGeometry & { person: Person }) {
  const at = polar((r0 + r1) / 2, (a0 + a1) / 2)
  const size = nameSize(generation)
  const room = labelRoom(r0, r1, a0, a1)
  const full = fullName(person)
  const first = firstName(person)
  const fit = fitLabel(room, size, full, first, initials(person))
  if (fit === 'none') return null
  const name = fit === 'full' ? full : fit === 'first' ? first : initials(person)
  const years = lifeYears(person)
  const yearSize = Math.round(size * 0.72)
  const withYears = generation <= 3 && years !== null && textWidth(years, yearSize) <= room && r1 - r0 > size * 3
  return (
    <text x={at.x} y={at.y} textAnchor="middle" className="pointer-events-none">
      <tspan x={at.x} dy={withYears ? '-0.15em' : '0.35em'} className="fill-stone-900 font-serif" style={{ fontSize: size }}>
        {name}
      </tspan>
      {withYears && (
        <tspan x={at.x} dy="1.45em" className="fill-stone-600" style={{ fontSize: yearSize }}>
          {years}
        </tspan>
      )}
    </text>
  )
}

/** "+ Add" in an empty slot, or just "+" where that doesn't fit. */
function EmptyLabel({ generation, r0, r1, a0, a1, label }: SlotGeometry & { label: string }) {
  const at = polar((r0 + r1) / 2, (a0 + a1) / 2)
  const size = Math.min(12, nameSize(generation))
  const room = labelRoom(r0, r1, a0, a1)
  const text = textWidth(`+ ${label}`, size) <= room ? `+ ${label}` : '+'
  return (
    <text
      x={at.x}
      y={at.y}
      dy="0.35em"
      textAnchor="middle"
      className="pointer-events-none fill-stone-400 font-medium group-hover:fill-(--accent)"
      style={{ fontSize: text === '+' ? size + 3 : size }}
    >
      {text}
    </text>
  )
}

/** "2×" near the outer edge of a slot whose person also fills another one. */
function RepeatBadge({ r1, angle, times }: { r1: number; angle: number; times: number }) {
  const at = polar(r1 - 12, angle)
  return (
    <g className="pointer-events-none">
      <circle cx={at.x} cy={at.y} r={9} className="fill-stone-900" />
      <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" className="fill-stone-50 font-semibold" style={{ fontSize: 8 }}>
        {times}×
      </text>
    </g>
  )
}

/** The ring names along the baseline, and which side is whose. */
function Baseline({ radii, generations, outer }: { radii: number[]; generations: number; outer: number }) {
  const { t } = useT()
  const names = []
  for (let g = 1; g <= generations; g++) {
    const width = radii[g + 1] - radii[g]
    const label = g <= 3 ? t(`fan.ring${g as 1 | 2 | 3}`) : t('fan.ringN', { n: g })
    if (textWidth(label, 11) > width + 16) continue
    const mid = (radii[g] + radii[g + 1]) / 2
    for (const side of [-1, 1]) {
      names.push(
        <text key={`${g}${side}`} x={side * mid} y={20} textAnchor="middle" className="fill-stone-400 font-medium" style={{ fontSize: 11 }}>
          {label}
        </text>,
      )
    }
  }
  return (
    <g className="pointer-events-none">
      <line x1={-outer} x2={outer} y1={1} y2={1} className="stroke-stone-200" />
      {names}
      <text x={-outer} y={44} className="fill-stone-400 font-semibold tracking-[0.12em] uppercase" style={{ fontSize: 10 }}>
        ← {t('fan.fathersSide')}
      </text>
      <text x={outer} y={44} textAnchor="end" className="fill-stone-400 font-semibold tracking-[0.12em] uppercase" style={{ fontSize: 10 }}>
        {t('fan.mothersSide')} →
      </text>
    </g>
  )
}
