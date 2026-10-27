import { Network, Rainbow, type LucideIcon } from 'lucide-react'
import { useT } from '../i18n'
import { TREE_VIEWS, type TreeView } from '../storage/workspace'

const ICONS: Record<TreeView, LucideIcon> = { tree: Network, fan: Rainbow }

/** Switches how the open tab shows its tree, floating over the canvas's top-left corner. */
export function ViewSwitcher({ view, onChange }: { view: TreeView; onChange: (view: TreeView) => void }) {
  const { t } = useT()
  return (
    <div
      role="group"
      aria-label={t('views.label')}
      className="absolute top-3 left-3 z-[8] flex gap-0.5 rounded-xl border border-stone-200 bg-white/90 p-1 shadow-sm backdrop-blur"
    >
      {TREE_VIEWS.map((id) => {
        const Icon = ICONS[id]
        const active = id === view
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-1.5 rounded-lg py-1.5 pr-3 pl-2.5 text-sm font-medium transition focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
              active ? 'bg-stone-900 text-stone-50' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
            ].join(' ')}
          >
            <Icon className="size-4" aria-hidden />
            {t(`views.${id}`)}
          </button>
        )
      })}
    </div>
  )
}
