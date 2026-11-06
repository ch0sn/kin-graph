import { CircleQuestionMark } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'

/** A label followed by a "?" icon that explains it in a tooltip (one line if it fits, wrapped otherwise) on hover or focus. */
export function HelpLabel({
  label,
  about,
  help,
  id,
}: {
  label: ReactNode
  /** What the icon explains, for screen readers: "About <about>". Already translated. */
  about: string
  help: string
  id: string
}) {
  const { t } = useT()
  return (
    <div className="relative flex items-center gap-1.5">
      {label}
      <span className="group flex">
        <button
          type="button"
          aria-label={t('settings.about', { topic: about })}
          aria-describedby={id}
          className="rounded-full text-stone-400 transition hover:text-stone-700 focus-visible:text-stone-700 focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
        >
          <CircleQuestionMark className="size-4" aria-hidden />
        </button>
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-max max-w-full rounded-lg bg-stone-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100"
        >
          {help}
        </span>
      </span>
    </div>
  )
}
