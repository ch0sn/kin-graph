import { FileText, Lock, Star, TriangleAlert, Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { FamilyGraph } from '../model'
import { useT } from '../i18n'
import { useBackupPicker } from '../storage/useBackupPicker'
import { Button } from '../ui/fields'
import { Logo } from '../ui/Logo'
import { RootSetup } from './RootSetup'
import { slideVariants } from './stepMotion'

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
 * The first person is a short sequence of pages, not one long form.
 */
export function Welcome({ onStart, savedTrees = [], onOpenSaved, onCancel }: WelcomeProps) {
  const picker = useBackupPicker(onStart)
  // A first run goes straight to the name. Saved trees, or a new tree beside
  // one already open, get a chooser first so import and Cancel stay one tap away.
  const showChooser = savedTrees.length > 0 || onCancel !== undefined
  const [setup, setSetup] = useState(!showChooser)
  const [direction, setDirection] = useState<1 | -1>(1)

  const openSetup = () => {
    setDirection(1)
    setSetup(true)
  }
  const closeSetup = () => {
    setDirection(-1)
    setSetup(false)
  }

  return (
    <div className="relative h-full overflow-hidden bg-stone-50">
      {picker.input}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={setup ? 'setup' : 'chooser'}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          {setup ? (
            <RootSetup
              onStart={onStart}
              onBack={showChooser ? closeSetup : undefined}
              backLabel={onCancel ? 'cancel' : 'back'}
              showImport={!showChooser}
              onImport={picker.open}
              importError={picker.error}
            />
          ) : (
            <Chooser
              savedTrees={savedTrees}
              onOpenSaved={onOpenSaved}
              onStartNew={openSetup}
              onImport={picker.open}
              importError={picker.error}
              onCancel={onCancel}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Chooser({
  savedTrees,
  onOpenSaved,
  onStartNew,
  onImport,
  importError,
  onCancel,
}: {
  savedTrees: { id: string; label: string; own: boolean }[]
  onOpenSaved?: (treeId: string) => void
  onStartNew: () => void
  onImport: () => void
  importError: string | null
  onCancel?: () => void
}) {
  const { t } = useT()
  return (
    <div className="h-full overflow-y-auto px-4">
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 py-10">
        <header className="flex flex-col items-center text-center">
          <Logo className="size-16" />
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-stone-900">KinGraph</h1>
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

        <Button variant="primary" className="w-full py-3" onClick={onStartNew}>
          {t('welcome.newTree')}
        </Button>

        <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-stone-400 uppercase">
          <span className="h-px flex-1 bg-stone-200" />
          {t('welcome.or')}
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full py-3" onClick={onImport}>
            <Upload className="size-4" aria-hidden />
            {t('welcome.import')}
          </Button>
          <p className="text-center text-xs text-stone-500">{t('welcome.importHint')}</p>
          {importError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {importError}
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
      </main>
    </div>
  )
}
