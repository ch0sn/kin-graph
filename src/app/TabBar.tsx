import { Eye, FilePlus, FileText, Plus, Star, Trash2, Upload, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'

export interface TabItem {
  id: string
  kind: 'own' | 'tree' | 'view'
  label: string
  /** Longer description for the tooltip, e.g. whose view of which tree. */
  title?: string
}

export interface SavedTreeItem {
  id: string
  label: string
  own: boolean
}

interface TabBarProps {
  tabs: TabItem[]
  activeId: string | null
  /** Shows a tab for a tree that is being started, which Cancel closes. */
  creating: boolean
  onCancelCreating: () => void
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onNewTree: () => void
  onImport: () => void
  /** Trees that are saved but have no tab open. */
  closedTrees: SavedTreeItem[]
  onOpenTree: (treeId: string) => void
  onDeleteTree: (treeId: string) => void
  /** Where the tree's view controls hang, from the bar's bottom-right corner. */
  controlsRef: (element: HTMLElement | null) => void
}

const KIND_ICONS = { own: Star, tree: FileText, view: Eye }

/** One tab per open tree, under the header, plus a menu to open or start more. */
export function TabBar({
  tabs,
  activeId,
  creating,
  onCancelCreating,
  onSelect,
  onClose,
  onNewTree,
  onImport,
  closedTrees,
  onOpenTree,
  onDeleteTree,
  controlsRef,
}: TabBarProps) {
  const { t } = useT()
  const activeRef = useRef<HTMLDivElement>(null)

  // Keep the active tab in sight when there are more tabs than fit.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, creating])

  return (
    <div className="relative z-[9] flex items-end border-b border-stone-200 bg-white/80 pl-2 backdrop-blur">
      <div
        role="tablist"
        aria-label={t('tabs.label')}
        className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pt-1.5 [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const active = !creating && tab.id === activeId
          const Icon = KIND_ICONS[tab.kind]
          return (
            <div
              key={tab.id}
              ref={active ? activeRef : undefined}
              title={tab.title ?? (tab.kind === 'own' ? t('tabs.own') : tab.label)}
              className={[
                'group -mb-px flex max-w-[12rem] shrink-0 items-center rounded-t-xl border text-sm transition',
                active
                  ? 'border-stone-200 border-b-stone-50 bg-stone-50 text-stone-900'
                  : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800',
              ].join(' ')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(tab.id)}
                className="flex min-w-0 items-center gap-1.5 py-1.5 pl-3 font-medium focus-visible:outline-none"
              >
                <Icon
                  className={[
                    'size-3.5 shrink-0',
                    tab.kind === 'own' ? 'fill-(--accent) text-(--accent)' : 'text-stone-400',
                  ].join(' ')}
                  aria-hidden
                />
                <span className="truncate">{tab.label}</span>
              </button>
              <button
                type="button"
                aria-label={t('tabs.close', { name: tab.label })}
                onClick={() => onClose(tab.id)}
                className={[
                  'mx-1 rounded-md p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-800 focus-visible:opacity-100',
                  active ? '' : 'sm:opacity-0 sm:group-hover:opacity-100',
                ].join(' ')}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
        {creating && (
          <div
            ref={activeRef}
            className="-mb-px flex shrink-0 items-center rounded-t-xl border border-stone-200 border-b-stone-50 bg-stone-50 text-sm text-stone-900"
          >
            <span role="tab" aria-selected className="flex items-center gap-1.5 py-1.5 pl-3 font-medium">
              <FilePlus className="size-3.5 text-stone-400" aria-hidden />
              {t('tabs.creating')}
            </span>
            <button
              type="button"
              aria-label={t('common.cancel')}
              onClick={onCancelCreating}
              className="mx-1 rounded-md p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-800"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <AddMenu
        onNewTree={onNewTree}
        onImport={onImport}
        closedTrees={closedTrees}
        onOpenTree={onOpenTree}
        onDeleteTree={onDeleteTree}
      />
      <div ref={controlsRef} className="absolute top-full right-0" />
    </div>
  )
}

function AddMenu({
  onNewTree,
  onImport,
  closedTrees,
  onOpenTree,
  onDeleteTree,
}: Pick<TabBarProps, 'onNewTree' | 'onImport' | 'closedTrees' | 'onOpenTree' | 'onDeleteTree'>) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative shrink-0 self-center px-1">
      <button
        type="button"
        title={t('tabs.add')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg py-1.5 pr-2.5 pl-2 text-sm font-medium whitespace-nowrap text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden />
        {t('header.newTree')}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-1 z-30 mt-1.5 w-72 origin-top-right rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
          >
            <MenuItem icon={<FilePlus />} onClick={choose(onNewTree)}>
              {t('tabs.newTree')}
            </MenuItem>
            <MenuItem icon={<Upload />} onClick={choose(onImport)}>
              {t('tabs.import')}
            </MenuItem>
            <p className="mt-1.5 border-t border-stone-100 px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.12em] text-stone-400 uppercase">
              {t('tabs.saved')}
            </p>
            {closedTrees.length === 0 ? (
              <p className="px-3 pt-0.5 pb-2 text-xs text-stone-500">{t('tabs.allOpen')}</p>
            ) : (
              closedTrees.map((tree) => (
                <div key={tree.id} className="flex items-center">
                  <MenuItem
                    icon={tree.own ? <Star className="fill-(--accent) !text-(--accent)" /> : <FileText />}
                    onClick={choose(() => onOpenTree(tree.id))}
                  >
                    <span className="truncate">{tree.label}</span>
                  </MenuItem>
                  <button
                    type="button"
                    title={t('tabs.delete')}
                    aria-label={`${t('tabs.delete')} ${tree.label}`}
                    onClick={choose(() => onDeleteTree(tree.id))}
                    className="mr-1 rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-stone-800 transition hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-stone-500"
    >
      {icon}
      {children}
    </button>
  )
}
