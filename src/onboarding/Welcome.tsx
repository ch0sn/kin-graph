import { FileText, Lock, Star, TriangleAlert, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { createGraph, type FamilyGraph } from '../model'
import { PersonForm } from '../sheet/PersonForm'
import { emptyValues } from '../sheet/personValues'
import { useT } from '../i18n'
import { useBackupPicker } from '../storage/useBackupPicker'
import { Button } from '../ui/fields'

interface WelcomeProps {
  onStart: (graph: FamilyGraph) => void
  /** Saved trees with no tab open, offered above starting a new one. */
  savedTrees?: { id: string; label: string; own: boolean }[]
  onOpenSaved?: (treeId: string) => void
  /** When starting another tree, a way back. */
  onCancel?: () => void
}

/**
 * Start a tree or import one: shown when nothing is saved
 * yet, when starting another tree, and when no tab is open.
 */
export function Welcome({ onStart, savedTrees = [], onOpenSaved, onCancel }: WelcomeProps) {
  const { t } = useT()
  const picker = useBackupPicker(onStart)

  return (
    <div className="h-full overflow-y-auto bg-stone-50 px-4">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 py-10"
      >
        <header className="text-center">
          <h1 className="font-serif text-4xl tracking-tight text-stone-900">KinGraph</h1>
          <p className="mt-2 text-stone-600">{t('welcome.tagline')}</p>
        </header>

        {savedTrees.length > 0 && onOpenSaved && (
          <section aria-labelledby="welcome-saved" className="flex flex-col gap-2">
            <h2 id="welcome-saved" className="text-sm font-semibold text-stone-900">
              {t('welcome.savedTrees')}
            </h2>
            {savedTrees.map((tree) => (
              <Button key={tree.id} className="w-full justify-start py-3" onClick={() => onOpenSaved(tree.id)}>
                {tree.own ? (
                  <Star className="size-4 fill-(--accent) text-(--accent)" aria-hidden />
                ) : (
                  <FileText className="size-4 text-stone-500" aria-hidden />
                )}
                <span className="truncate">{tree.label}</span>
              </Button>
            ))}
          </section>
        )}

        <section
          aria-labelledby="welcome-start"
          className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <h2 id="welcome-start" className="mb-4 font-serif text-xl text-stone-900">
            {t('welcome.who')}
          </h2>
          <PersonForm
            initial={emptyValues()}
            submitLabel={t('welcome.startTree')}
            error={null}
            onSubmit={(you) => onStart(createGraph(you))}
          />
        </section>

        <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-stone-400 uppercase">
          <span className="h-px flex-1 bg-stone-200" />
          {t('welcome.or')}
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full py-3" onClick={picker.open}>
            <Upload className="size-4" aria-hidden />
            {t('welcome.import')}
          </Button>
          <p className="text-center text-xs text-stone-500">{t('welcome.importHint')}</p>
          {picker.input}
          {picker.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {picker.error}
            </p>
          )}
        </div>

        <footer className="flex flex-col items-center gap-3 text-sm">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <Lock className="size-3.5" aria-hidden />
            {t('welcome.private')}
          </p>
        </footer>
      </motion.main>
    </div>
  )
}
