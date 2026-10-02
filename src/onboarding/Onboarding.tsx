import { ShieldCheck, Sprout, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useT } from '../i18n'
import { Button } from '../ui/fields'

const STEPS = [
  { icon: Sprout, title: 'onboarding.step1.title', body: 'onboarding.step1.body' },
  { icon: UserPlus, title: 'onboarding.step2.title', body: 'onboarding.step2.body' },
  { icon: ShieldCheck, title: 'onboarding.step3.title', body: 'onboarding.step3.body' },
] as const

/** A short introduction shown the first time KinGraph is opened. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const Icon = step.icon

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-stone-50 px-4">
      <header className="mx-auto flex w-full max-w-md items-center justify-between py-4">
        <span className="font-serif text-xl tracking-tight">KinGraph</span>
        {/* Hidden rather than removed on the last step so the header doesn't shift. */}
        <Button variant="ghost" onClick={onDone} className={isLast ? 'invisible' : ''}>
          {t('common.skip')}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center pb-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={index}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            aria-live="polite"
            className="flex flex-col items-center text-center"
          >
            <div className="mb-8 flex size-28 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent-ink) ring-8 ring-(--accent-glow)">
              <Icon className="size-12" strokeWidth={1.5} aria-hidden />
            </div>
            <h1 className="font-serif text-3xl leading-tight text-balance text-stone-900">
              {t(step.title)}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-pretty text-stone-600">{t(step.body)}</p>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="mx-auto flex w-full max-w-md flex-col items-center gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2" aria-label={t('onboarding.stepOf', { step: index + 1, total: STEPS.length })} role="img">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-6 bg-stone-900' : 'w-1.5 bg-stone-300',
              ].join(' ')}
            />
          ))}
        </div>
        <div className="flex w-full gap-2">
          {index > 0 && (
            <Button className="flex-1" onClick={() => setIndex(index - 1)}>
              {t('common.back')}
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => (isLast ? onDone() : setIndex(index + 1))}
          >
            {isLast ? t('onboarding.start') : t('common.next')}
          </Button>
        </div>
      </footer>
    </div>
  )
}
