import { ChartGantt, Check, ChevronDown, Network, Rainbow, Search, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import type { TreeView } from '../storage/workspace'

const mobileViews: readonly TreeView[] = ['tree', 'fan', 'timeline']
const icons: Record<TreeView, LucideIcon> = { tree: Network, fan: Rainbow, timeline: ChartGantt }
const controlsLabels = { tree: 'mobile.treeControls', fan: 'fan.view', timeline: 'timeline.view' } as const
const buttonStyle = 'flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-1 text-sm font-semibold leading-tight focus-visible:outline-2 focus-visible:outline-(--accent) [&_svg]:size-4 [&_svg]:shrink-0'

export interface MobileControlSlots {
  options: HTMLElement | null
}

export function MobileControls({
  view,
  onChange,
  onFind,
  onOptions,
  returnAction,
}: {
  view: TreeView
  onChange: (view: TreeView) => void
  onFind: () => void
  onOptions: (element: HTMLElement | null) => void
  returnAction?: ReactNode
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const Icon = icons[view]

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      toggle.current?.focus()
    }
    const query = window.matchMedia('(min-width: 640px)')
    const resize = () => {
      if (query.matches) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    query.addEventListener('change', resize)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      query.removeEventListener('change', resize)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[21] grid h-(--mobile-dock) grid-cols-2 items-start gap-2 border-t border-stone-200 bg-stone-50 px-4 pt-3 sm:hidden" aria-label={t('views.label')} role="group">
      <button type="button" className={`${buttonStyle} border-stone-200 bg-white text-stone-900`} onClick={() => { setOpen(false); onFind() }}>
        <Search aria-hidden />
        <span>{t('mobile.findPerson')}</span>
      </button>
      <div ref={menu} className="min-w-0">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-view-options"
          onClick={() => setOpen(!open)}
          className={`${buttonStyle} w-full border-transparent bg-(--accent-soft) text-(--accent-ink)`}
        >
          <Icon aria-hidden />
          <span>{t(`views.${view}`)}</span>
          <ChevronDown className="ml-auto !size-3" aria-hidden />
        </button>
        <section
          id="mobile-view-options"
          aria-label={t('views.label')}
          hidden={!open}
          className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] max-h-[min(65dvh,28rem)] overflow-y-auto overscroll-contain rounded-[20px] border border-stone-200 bg-white px-2 py-2 shadow-lg"
        >
          <h2 className="px-2 pt-1 pb-2 text-xs font-semibold text-stone-500">{t('mobile.views')}</h2>
          {mobileViews.map((id) => (
            <MobileOption key={id} icon={icons[id]} label={t(`views.${id}`)} pressed={view === id} onClick={() => { onChange(id); close() }} />
          ))}
          <div className="mx-2 mt-2 border-t border-stone-200 pt-3">
            <h2 className="pb-1 text-xs font-semibold text-stone-500">{t(controlsLabels[view])}</h2>
          </div>
          <div ref={onOptions} onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('button[data-close-view]')) close()
          }} />
          {returnAction && <div className="mt-1 border-t border-stone-200 pt-1" onClick={close}>{returnAction}</div>}
        </section>
      </div>
    </div>
  )
}

export function MobileOption({
  icon: Icon, label, description, onClick, pressed, disabled, close, switchControl = false,
}: {
  icon: LucideIcon
  label: string
  description?: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  close?: boolean
  switchControl?: boolean
}) {
  return (
    <button
      type="button"
      title={description}
      aria-label={description ? `${label}: ${description}` : undefined}
      role={switchControl ? 'switch' : undefined}
      aria-checked={switchControl ? pressed : undefined}
      aria-pressed={switchControl ? undefined : pressed}
      disabled={disabled}
      data-close-view={close || undefined}
      className="group/option flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-(--accent) disabled:opacity-45 aria-pressed:bg-(--accent-soft) aria-pressed:text-(--accent-ink)"
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words">
        <span className="block">{label}</span>
        {description && (
          <span className={`mt-0.5 text-xs font-normal text-stone-500 ${pressed ? 'block' : 'hidden group-hover/option:block group-focus-visible/option:block'}`}>
            {description}
          </span>
        )}
      </span>
      {switchControl ? (
        <span aria-hidden className={`flex h-[22px] w-9 shrink-0 items-center rounded-full p-[3px] ${pressed ? 'justify-end bg-(--accent)' : 'bg-stone-200'}`}>
          <span className="size-4 rounded-full bg-white" />
        </span>
      ) : pressed && <Check className="size-4 shrink-0" aria-hidden />}
    </button>
  )
}
