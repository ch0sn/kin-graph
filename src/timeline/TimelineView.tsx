import { CalendarClock, LocateFixed } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import {
  ancestorsOf,
  childIdsOf,
  dateBounds,
  descendantsOf,
  formatYear,
  fullName,
  lifeYears,
  parentIdsOf,
  partnerOf,
  partnershipsOf,
  yearOf,
  type FamilyGraph,
  type PersonId,
} from '../model'
import { ViewButton, ViewToolbar } from '../ui/ViewToolbar'
import { timelineRows } from './rows'
import { aliveIn, ageIn, fractionalYear, lifeSpan, todayYear, type LifeSpan } from './spans'

interface TimelineViewProps {
  graph: FamilyGraph
  selectedId: PersonId | null
  onSelect: (id: PersonId | null) => void
  /** Where the view controls are drawn, outside the canvas; none are shown until it exists. */
  controlsSlot: HTMLElement | null
}

const ROW = 30
const HEAD = 30
const BAR = 12
/** Space left of the axis for names: wide enough for most names, narrower on phones. */
const NAMES_WIDE = 216
const NAMES_NARROW = 92
/** Empty space after today, so the living don't run into the edge. */
const PAD_YEARS = 4
/** Room on the right for the view controls hanging over the canvas. */
const CONTROLS = 64

type Line =
  | { kind: 'head'; generation: number | null; top: number }
  | { kind: 'person'; id: PersonId; span: LifeSpan; top: number }

/** Year marks far enough apart to read, on round numbers. */
function tickStep(pxPerYear: number): number {
  return [5, 10, 20, 25, 50, 100].find((step) => step * pxPerYear >= 56) ?? 100
}

/**
 * Everyone's life as a bar on one year axis, grouped by generation relative
 * to the tree's root. Uncertain dates fade instead of ending sharply. A year
 * scrubber shows who was alive and how old; selecting someone draws lines to
 * their parents and children.
 */
export function TimelineView({ graph, selectedId, onSelect, controlsSlot }: TimelineViewProps) {
  const { t } = useT()
  const rootId = graph.managerId
  const root = graph.people[rootId]
  /** Fixed while the view is open, so bars don't creep along between renders. */
  const [today] = useState(() => new Date())
  const now = todayYear(today)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [year, setYear] = useState(() => (root.birthDate && yearOf(root.birthDate)) || today.getFullYear())

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(() => timelineRows(graph, rootId), [graph, rootId])
  const spans = useMemo(() => {
    const result = new Map<PersonId, LifeSpan>()
    for (const group of rows.groups) {
      for (const id of group.personIds) {
        const span = lifeSpan(graph, graph.people[id], today)
        if (span) result.set(id, span)
      }
    }
    return result
  }, [graph, rows, today])
  /** The root's direct line, whose family lines are drawn in the accent like the tree's lineage. */
  const directLine = useMemo(
    () => new Set([...ancestorsOf(graph, rootId).keys(), ...descendantsOf(graph, rootId).keys()]),
    [graph, rootId],
  )

  const lines: Line[] = []
  let height = 0
  for (const group of rows.groups) {
    lines.push({ kind: 'head', generation: group.generation, top: height })
    height += HEAD
    for (const id of group.personIds) {
      const span = spans.get(id)
      if (!span) continue
      lines.push({ kind: 'person', id, span, top: height })
      height += ROW
    }
  }
  const rowTop = new Map(lines.flatMap((l) => (l.kind === 'person' ? [[l.id, l.top] as const] : [])))

  const earliest = Math.min(now - 30, ...[...spans.values()].map((s) => s.start))
  const from = Math.floor((earliest - 2) / 10) * 10
  const to = now + PAD_YEARS
  const names = width < 640 ? NAMES_NARROW : NAMES_WIDE
  const chartWidth = Math.max(width - names - CONTROLS, 160)
  const pxPerYear = chartWidth / (to - from)
  const x = (y: number) => (y - from) * pxPerYear
  const step = tickStep(pxPerYear)
  const ticks: number[] = []
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y)

  const clampYear = (y: number) => Math.round(Math.min(Math.floor(now), Math.max(from, y)))
  const yearAt = (clientX: number, element: HTMLElement) =>
    clampYear(from + (clientX - element.getBoundingClientRect().left) / pxPerYear)

  const scrub = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setYear(yearAt(e.clientX, e.currentTarget))
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) setYear(yearAt(e.clientX, e.currentTarget))
    },
    onKeyDown: (e: KeyboardEvent) => {
      const by = e.shiftKey ? 10 : 1
      const next =
        e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? year - by
          : e.key === 'ArrowRight' || e.key === 'ArrowUp'
            ? year + by
            : e.key === 'Home'
              ? from
              : e.key === 'End'
                ? now
                : null
      if (next === null) return
      e.preventDefault()
      setYear(clampYear(next))
    },
  }

  let alive = 0
  let unsure = 0
  for (const span of spans.values()) {
    const state = aliveIn(span, year)
    if (state === 'yes') alive++
    if (state === 'maybe') unsure++
  }

  const goHome = () => {
    if (root.birthDate) setYear(clampYear(yearOf(root.birthDate) ?? now))
    scrollRef.current
      ?.querySelector(`[data-person="${CSS.escape(rootId)}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const generationLabel = (generation: number | null) => {
    if (generation === null) return t('timeline.unconnected')
    if (generation === 0) return t('timeline.gen0')
    if (generation >= -3 && generation <= 2) return t(`timeline.gen${generation}` as 'timeline.gen-1')
    return generation < 0 ? t('timeline.genUp', { n: -generation }) : t('timeline.genDown', { n: generation })
  }

  // Family lines for the selected person: from each parent's bar at their birth, and to each child's.
  const family: { id: PersonId; parentId: PersonId; childId: PersonId; at: number; accent: boolean }[] = []
  const selectedSpan = selectedId ? spans.get(selectedId) : undefined
  if (selectedId && selectedSpan) {
    for (const parentId of parentIdsOf(graph, selectedId)) {
      if (!rowTop.has(parentId)) continue
      family.push({
        id: `p${parentId}`,
        parentId,
        childId: selectedId,
        at: selectedSpan.solidStart,
        accent: directLine.has(parentId) && directLine.has(selectedId),
      })
    }
    for (const childId of childIdsOf(graph, selectedId)) {
      const childSpan = spans.get(childId)
      if (!childSpan) continue
      family.push({
        id: `c${childId}`,
        parentId: selectedId,
        childId,
        at: childSpan.solidStart,
        accent: directLine.has(childId) && directLine.has(selectedId),
      })
    }
  }

  return (
    <div
      className={[
        'absolute inset-x-0 top-14 bottom-0 transition-[padding] duration-300 ease-out motion-reduce:transition-none',
        // Make room for the person sheet: beside it on wide screens, above it on phones.
        selectedId ? 'pb-[50dvh] sm:pb-0 sm:pl-[min(34rem,55%)]' : '',
      ].join(' ')}
    >
      <div ref={scrollRef} className="size-full overflow-auto overscroll-contain">
        {width > 0 && (
          <div className="relative pb-8" style={{ width: names + chartWidth + CONTROLS }}>
            {/* The axis and year scrubber stay at the top while the rows scroll. */}
            <div className="sticky top-0 z-[3] flex h-10 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
              <div style={{ width: names }} className="shrink-0" />
              <div
                role="slider"
                tabIndex={0}
                aria-label={t('timeline.year')}
                aria-valuemin={from}
                aria-valuemax={Math.floor(now)}
                aria-valuenow={year}
                aria-valuetext={t('timeline.alive', { year, count: alive })}
                className="relative cursor-ew-resize touch-none outline-none focus-visible:ring-4 focus-visible:ring-stone-200"
                style={{ width: chartWidth }}
                {...scrub}
              >
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute bottom-1.5 -translate-x-1/2 text-[11px] text-stone-400 tabular-nums select-none"
                    style={{ left: x(tick) }}
                  >
                    {tick}
                  </span>
                ))}
                <span
                  className="absolute top-1 -translate-x-1/2 rounded-full border-2 border-(--accent) bg-white px-2 py-px text-[11px] font-semibold whitespace-nowrap text-stone-900 shadow-sm select-none"
                  style={{ left: x(year + 0.5) }}
                >
                  {t('timeline.alive', { year, count: alive })}
                  {unsure > 0 && ` · ${t('timeline.unsure', { count: unsure })}`}
                </span>
              </div>
            </div>

            {/* Its own layer, so badges and lines in the rows never cover the sticky axis. */}
            <div className="relative isolate" style={{ height }}>
              {/* Decades, today and the scrubber run behind the rows. */}
              <div className="pointer-events-none absolute inset-y-0" style={{ left: names, width: chartWidth }}>
                {ticks.map((tick) => (
                  <div key={tick} className="absolute inset-y-0 w-px bg-stone-200/70" style={{ left: x(tick) }} />
                ))}
                <div className="absolute inset-y-0 border-l border-dashed border-stone-400" style={{ left: x(now) }} />
                <div className="absolute inset-y-0 z-[1] w-0.5 -translate-x-1/2 bg-(--accent)" style={{ left: x(year + 0.5) }} />
              </div>

              {lines.map((line) =>
                line.kind === 'head' ? (
                  <h3
                    key={`head${line.generation}`}
                    className="absolute inset-x-0 flex items-end px-3 pb-1 text-[10px] font-semibold tracking-[0.12em] text-stone-400 uppercase"
                    style={{ top: line.top, height: HEAD }}
                  >
                    {generationLabel(line.generation)}
                  </h3>
                ) : (
                  <PersonRow
                    key={line.id}
                    graph={graph}
                    id={line.id}
                    span={line.span}
                    top={line.top}
                    names={names}
                    x={x}
                    year={year}
                    isRoot={line.id === rootId}
                    selected={line.id === selectedId}
                    onSelect={onSelect}
                  />
                ),
              )}

              <svg
                aria-hidden
                className="pointer-events-none absolute top-0 z-[1] overflow-visible"
                style={{ left: names, width: chartWidth, height }}
              >
                {family.map((link) => {
                  const cx = x(link.at)
                  const y1 = rowTop.get(link.parentId)! + ROW / 2
                  const y2 = rowTop.get(link.childId)! + ROW / 2
                  return (
                    <g key={link.id} className={link.accent ? 'stroke-(--accent)' : 'stroke-stone-400'}>
                      <line x1={cx} x2={cx} y1={y1} y2={y2} strokeWidth={link.accent ? 2 : 1.5} />
                      <circle cx={cx} cy={y1} r={4} strokeWidth={2} className="fill-white" />
                    </g>
                  )
                })}
              </svg>
            </div>

            {rows.undated.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2 px-3">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-stone-400 uppercase">
                  {t('timeline.undated')}
                </span>
                {rows.undated.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    className={[
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
                      id === selectedId
                        ? 'border-(--accent) bg-(--accent-soft) text-stone-900'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100',
                    ].join(' ')}
                  >
                    {fullName(graph.people[id])}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {controlsSlot &&
        createPortal(
          <ViewToolbar label={t('timeline.view')}>
            <ViewButton label={t('timeline.home')} onClick={goHome}>
              <LocateFixed className="size-5" aria-hidden />
            </ViewButton>
            <ViewButton label={t('timeline.now')} onClick={() => setYear(Math.floor(now))}>
              <CalendarClock className="size-5" aria-hidden />
            </ViewButton>
          </ViewToolbar>,
          controlsSlot,
        )}
    </div>
  )
}

/** One person: their name, their life as a bar, partnership marks and, under the scrubber, their age. */
function PersonRow({
  graph,
  id,
  span,
  top,
  names,
  x,
  year,
  isRoot,
  selected,
  onSelect,
}: {
  graph: FamilyGraph
  id: PersonId
  span: LifeSpan
  top: number
  names: number
  x: (year: number) => number
  year: number
  isRoot: boolean
  selected: boolean
  onSelect: (id: PersonId) => void
}) {
  const { t } = useT()
  const person = graph.people[id]
  const years = lifeYears(person)
  const colour = isRoot
    ? 'var(--accent)'
    : span.living
      ? 'color-mix(in oklab, var(--accent) 38%, var(--color-white))'
      : 'var(--color-stone-300)'
  const length = span.end - span.start || 1
  const solidFrom = ((span.solidStart - span.start) / length) * 100
  const solidTo = ((span.solidEnd - span.start) / length) * 100
  const background = `linear-gradient(to right, ${solidFrom > 0 ? 'transparent' : colour} 0%, ${colour} ${solidFrom}%, ${colour} ${solidTo}%, ${solidTo < 100 ? 'transparent' : colour} 100%)`

  const state = aliveIn(span, year)
  const age = state === 'yes' ? ageIn(person, year) : state === 'maybe' ? '?' : null

  const marks = partnershipsOf(graph, id).flatMap((partnership) => {
    const partner = graph.people[partnerOf(partnership, id)]
    const name = partner ? fullName(partner) : ''
    const result: { key: string; at: number; ended: boolean; title: string }[] = []
    const startBounds = partnership.startDate && dateBounds(partnership.startDate)
    if (startBounds && (startBounds.from || startBounds.to)) {
      result.push({
        key: `${partnership.id}s`,
        at: fractionalYear((startBounds.from ?? startBounds.to)!),
        ended: false,
        title: `${name} · ${t('partnership.start')} ${formatYear(partnership.startDate!)}`,
      })
    }
    const endBounds = partnership.endDate && dateBounds(partnership.endDate)
    if (endBounds && (endBounds.from || endBounds.to) && partnership.status !== 'widowed') {
      result.push({
        key: `${partnership.id}e`,
        at: fractionalYear((endBounds.from ?? endBounds.to)!),
        ended: true,
        title: `${name} · ${t(`status.${partnership.status}`)} ${formatYear(partnership.endDate!)}`,
      })
    }
    return result
  })

  return (
    <button
      type="button"
      data-person={id}
      aria-pressed={selected}
      aria-label={[fullName(person), years].filter(Boolean).join(', ')}
      onClick={() => onSelect(id)}
      className={[
        'group absolute inset-x-0 flex items-center text-left transition-colors focus-visible:z-[2] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        selected ? 'bg-(--accent-soft)' : 'hover:bg-stone-100',
      ].join(' ')}
      style={{ top, height: ROW }}
    >
      <span className="flex min-w-0 shrink-0 items-baseline gap-2 px-3" style={{ width: names }}>
        <span className={['truncate font-serif text-sm text-stone-900', isRoot || selected ? 'font-semibold' : ''].join(' ')}>
          {fullName(person)}
        </span>
        {years && names > NAMES_NARROW && (
          <span className="shrink-0 text-[11px] text-stone-400 tabular-nums">{years}</span>
        )}
      </span>
      <span className="relative h-full flex-1">
        <span
          className={['absolute rounded-full', selected ? 'ring-2 ring-(--accent)' : ''].join(' ')}
          style={{ left: x(span.start), width: Math.max(x(span.end) - x(span.start), 3), top: (ROW - BAR) / 2, height: BAR, background }}
        />
        {span.endUnknown && (
          <span className="absolute text-xs font-semibold text-stone-400" style={{ left: x(span.end) + 4, top: 6 }}>
            ?
          </span>
        )}
        {marks.map((mark) => (
          <span
            key={mark.key}
            title={mark.title}
            className={[
              'absolute size-2.5 -translate-x-1/2 rotate-45 border-[1.5px] border-stone-600',
              mark.ended ? 'border-dashed bg-stone-50' : 'bg-white',
            ].join(' ')}
            style={{ left: x(mark.at), top: (ROW - 10) / 2 }}
          />
        ))}
        {age && (
          <span
            className="absolute z-[2] rounded-full border border-stone-300 bg-white px-1.5 text-[10px] leading-4 font-medium text-stone-700 tabular-nums"
            style={{ left: x(year + 0.5) + 5, top: (ROW - 18) / 2 }}
          >
            {age}
          </span>
        )}
      </span>
    </button>
  )
}
