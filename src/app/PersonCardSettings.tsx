import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { useT, type MessageKey } from '../i18n'
import type { PersonCardPreferences, PersonCardSection } from '../storage/settings'

const LABELS: Record<PersonCardSection, MessageKey> = {
  location: 'location.label',
  lifeEvents: 'event.title',
  birthAndDeath: 'sheet.birthAndDeath',
  notes: 'form.notes',
}

export function PersonCardSettings({
  visibility,
  order,
  onVisibilityChange,
  onOrderChange,
}: {
  visibility: PersonCardPreferences
  order: PersonCardSection[]
  onVisibilityChange: (visibility: PersonCardPreferences) => void
  onOrderChange: (order: PersonCardSection[]) => void
}) {
  const { t } = useT()
  const helpId = useId()
  const [dragOrder, setDragOrder] = useState<PersonCardSection[] | null>(null)
  const latestDragOrder = useRef<PersonCardSection[] | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rows = dragOrder ?? order

  const saveOrder = (next: PersonCardSection[], section: PersonCardSection) => {
    if (next.every((item, index) => item === order[index])) return
    onOrderChange(next)
    setAnnouncement(t('settings.personCardMoved', {
      section: t(LABELS[section]),
      position: next.indexOf(section) + 1,
      total: next.length,
    }))
  }

  const move = (section: PersonCardSection, direction: -1 | 1) => {
    const index = rows.indexOf(section)
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    next[index] = rows[target]
    next[target] = section
    saveOrder(next, section)
  }

  return (
    <fieldset aria-describedby={helpId}>
      <legend className="mb-1.5 text-sm font-semibold text-stone-900">{t('settings.personCard')}</legend>
      <p id={helpId} className="mb-2 text-sm text-stone-600">{t('settings.personCardHelp')}</p>
      <Reorder.Group
        axis="y"
        as="ol"
        role="list"
        values={rows}
        onReorder={(next) => {
          latestDragOrder.current = next
          setDragOrder(next)
        }}
        className="divide-y divide-stone-100"
      >
        {rows.map((section, index) => (
          <SectionRow
            key={section}
            section={section}
            visible={visibility[section]}
            canMoveUp={index > 0}
            canMoveDown={index < rows.length - 1}
            onVisibilityChange={(visible) => onVisibilityChange({ ...visibility, [section]: visible })}
            onMove={(direction) => move(section, direction)}
            onDragEnd={() => {
              const next = latestDragOrder.current
              latestDragOrder.current = null
              setDragOrder(null)
              if (next) saveOrder(next, section)
            }}
          />
        ))}
      </Reorder.Group>
      <p className="sr-only" role="status">{announcement}</p>
    </fieldset>
  )
}

function SectionRow({
  section,
  visible,
  canMoveUp,
  canMoveDown,
  onVisibilityChange,
  onMove,
  onDragEnd,
}: {
  section: PersonCardSection
  visible: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onVisibilityChange: (visible: boolean) => void
  onMove: (direction: -1 | 1) => void
  onDragEnd: () => void
}) {
  const { t } = useT()
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  const label = t(LABELS[section])
  const moveUp = t('settings.personCardMoveUp', { section: label })
  const moveDown = t('settings.personCardMoveDown', { section: label })
  const moveButton = 'grid h-11 w-8 shrink-0 place-items-center rounded-lg text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-stone-500 aria-disabled:text-stone-300 aria-disabled:hover:bg-transparent'

  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      transition={reducedMotion ? { duration: 0 } : undefined}
      tabIndex={-1}
      className="relative flex min-h-11 items-center gap-1 bg-white"
    >
      <span
        aria-hidden
        className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-stone-500 hover:bg-stone-100 active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.button === 0) dragControls.start(event)
        }}
      >
        <GripVertical className="size-4" />
      </span>
      <label className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-2 text-sm">
        <span className="break-words">{label}</span>
        <input
          type="checkbox"
          role="switch"
          checked={visible}
          onChange={(event) => onVisibilityChange(event.target.checked)}
          className="peer absolute inset-0 z-1 size-full cursor-pointer opacity-0"
        />
        <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full border border-stone-300 bg-stone-100 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-[18px] after:rounded-full after:bg-stone-500 after:transition-transform peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:after:translate-x-5 peer-checked:after:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-stone-500 peer-focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:after:transition-none" />
      </label>
      <div className="flex shrink-0">
        <button type="button" className={moveButton} aria-label={moveUp} title={moveUp} aria-disabled={!canMoveUp} onClick={canMoveUp ? () => onMove(-1) : undefined}>
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button type="button" className={moveButton} aria-label={moveDown} title={moveDown} aria-disabled={!canMoveDown} onClick={canMoveDown ? () => onMove(1) : undefined}>
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  )
}
