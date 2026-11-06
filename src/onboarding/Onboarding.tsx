import { ShieldCheck, Sprout, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useT } from '../i18n'
import { Button } from '../ui/fields'
import { Logo } from '../ui/Logo'
import { StepDots } from './StepDots'
import { slideVariants } from './stepMotion'

const STEPS = [
  { icon: Sprout, title: 'onboarding.step1.title', body: 'onboarding.step1.body' },
  { icon: UserPlus, title: 'onboarding.step2.title', body: 'onboarding.step2.body' },
  { icon: ShieldCheck, title: 'onboarding.step3.title', body: 'onboarding.step3.body' },
] as const

/** A short introduction shown the first time KinGraph is opened. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const Icon = step.icon

  const go = (next: number) => {
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stone-50 px-4">
      <header className="mx-auto flex w-full max-w-md items-center justify-between py-4">
        <span className="flex items-center gap-2 font-serif text-xl tracking-tight">
          <Logo />
          KinGraph
        </span>
        {/* Hidden rather than removed on the last step so the header doesn't shift. */}
        <Button variant="ghost" onClick={onDone} className={isLast ? 'invisible' : ''}>
          {t('common.skip')}
        </Button>
      </header>

      <main className="relative mx-auto min-h-0 w-full max-w-md flex-1">
        <AnimatePresence initial={false} custom={direction}>
          <motion.section
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto py-6 text-center"
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
        <StepDots
          index={index}
          count={STEPS.length}
          label={t('onboarding.stepOf', { step: index + 1, total: STEPS.length })}
        />
        <div className="flex w-full gap-2">
          {index > 0 && (
            <Button className="flex-1" onClick={() => go(index - 1)}>
              {t('common.back')}
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={() => (isLast ? onDone() : go(index + 1))}>
            {isLast ? t('onboarding.start') : t('common.next')}
          </Button>
        </div>
      </footer>
    </div>
  )
}
