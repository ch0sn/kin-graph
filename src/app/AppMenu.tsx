import {
  BookOpen,
  Check,
  Ellipsis,
  History,
  ShieldAlert,
  ShieldCheck,
  LoaderCircle,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import type { SaveState } from '../storage/autosave'

export function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useT()
  const content = {
    saving: { icon: <LoaderCircle className="size-3.5 animate-spin" />, text: t('save.saving') },
    saved: { icon: <Check className="size-3.5" />, text: t('save.saved') },
    failed: { icon: <TriangleAlert className="size-3.5" />, text: t('save.failed') },
  }[state]
  return (
    <p
      aria-live="polite"
      title={
        state === 'failed'
          ? t('save.failedHint')
          : t('save.savedHint')
      }
      className={[
        'flex items-center gap-1.5 text-xs font-medium',
        state === 'failed' ? 'text-red-700' : 'text-stone-500',
      ].join(' ')}
    >
      <span aria-hidden>{content.icon}</span>
      {/* On phones the header is full of buttons, so only the icon shows. */}
      <span className="sr-only sm:not-sr-only">{content.text}</span>
    </p>
  )
}

interface AppMenuProps {
  /** Whether the browser agreed to keep our data; null if not known yet. */
  persisted: boolean | null
  onShowIntro: () => void
  onOpenSettings: () => void
  /** Opens the check of the tree on show; unset while there's none. */
  onOpenCheck?: () => void
  /** How many issues the check found that aren't ignored. */
  issueCount?: number
  /** Opens the version history of the tree on show; unset while there's none. */
  onOpenHistory?: () => void
  /** A reminder that the last backup is old, if it is. */
  backupReminder?: string | null
}

export function AppMenu({
  persisted,
  onShowIntro,
  onOpenSettings,
  onOpenCheck,
  issueCount = 0,
  onOpenHistory,
  backupReminder,
}: AppMenuProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
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
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={issueCount > 0 ? `${t('menu.label')} (${t('check.issues', { count: issueCount })})` : t('menu.label')}
        title={issueCount > 0 ? t('check.issues', { count: issueCount }) : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
      >
        <Ellipsis className="size-5" />
        {/* Something in the tree check needs a look. */}
        {issueCount > 0 && (
          <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
          >
            {onOpenCheck && (
              <MenuItem icon={issueCount > 0 ? <ShieldAlert /> : <ShieldCheck />} onClick={choose(onOpenCheck)}>
                <span className="flex-1">{t('check.title')}</span>
                {issueCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {t('check.issues', { count: issueCount })}
                  </span>
                )}
              </MenuItem>
            )}
            {onOpenHistory && (
              <MenuItem icon={<History />} onClick={choose(onOpenHistory)}>
                {t('menu.history')}
              </MenuItem>
            )}
            <MenuItem icon={<SlidersHorizontal />} onClick={choose(onOpenSettings)}>
              {t('menu.settings')}
            </MenuItem>
            <MenuItem icon={<BookOpen />} onClick={choose(onShowIntro)}>
              {t('menu.intro')}
            </MenuItem>
            <p className="mt-1.5 border-t border-stone-100 px-3 pt-2.5 pb-1.5 text-xs leading-relaxed text-stone-500">
              {backupReminder && <span className="mb-1.5 block font-medium text-amber-800">{backupReminder}</span>}
              {persisted === false
                ? t('menu.notPersisted')
                : t('menu.persisted')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({
  icon,
  onClick,
  autoFocus,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  autoFocus?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      autoFocus={autoFocus}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-stone-800 transition hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none [&_svg]:size-4 [&_svg]:text-stone-500"
    >
      {icon}
      {children}
    </button>
  )
}
