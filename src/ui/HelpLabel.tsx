import { CircleQuestionMark } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../i18n'

/** A label followed by a "?" icon that explains it in a tooltip (one line if it fits, wrapped otherwise) on hover or focus. */
export function HelpLabel({
  label,
  about,
  help,
  id,
  place = 'above',
}: {
  label: ReactNode
  /** What the icon explains, for screen readers: "About <about>". Already translated. */
  about: string
  help: string
  id: string
  /** `end` sits the note beside the icon, on the same line as the label. */
  place?: 'above' | 'end'
}) {
  const { t } = useT()
  const beside = place === 'end'
  return (
    <div className="relative flex items-center gap-1.5">
      {label}
      <span className={beside ? 'group relative flex' : 'group flex'}>
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
          className={[
            'pointer-events-none absolute z-10 w-max rounded-lg bg-stone-900 text-left font-normal tracking-normal text-white normal-case opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100',
            beside
              ? 'bottom-0 left-full ml-2 max-w-[14rem] px-2.5 py-1 text-[11px] leading-[13px]'
              : 'bottom-full left-0 mb-2 max-w-full px-3 py-2 text-xs leading-snug',
          ].join(' ')}
        >
          {help}
        </span>
      </span>
    </div>
  )
}
