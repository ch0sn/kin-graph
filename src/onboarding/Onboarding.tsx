import { ShieldCheck, Sprout, UserPlus, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '../ui/fields'

interface Step {
  icon: LucideIcon
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: Sprout,
    title: 'You’re at the centre',
    body: 'Your tree grows outward from you. Everyone is labelled by how they’re related to you — mother, cousin, stepbrother, mother-in-law.',
  },
  {
    icon: UserPlus,
    title: 'Tap anyone to grow your family',
    body: 'Add parents, partners, siblings and children from anyone in the tree. KinGraph links siblings to their parents and works out step-family and in-laws for you.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    body: 'Your tree is saved on this device only — nothing is uploaded. Export a backup from the menu now and then so it’s never lost.',
  },
]

/** A short introduction shown the first time KinGraph is opened. */
export function Onboarding({ onDone }: { onDone: () => void }) {
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
          Skip
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
            <div className="mb-8 flex size-28 items-center justify-center rounded-full bg-amber-100 text-amber-800 ring-8 ring-amber-50">
              <Icon className="size-12" strokeWidth={1.5} aria-hidden />
            </div>
            <h1 className="font-serif text-3xl leading-tight text-balance text-stone-900">
              {step.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-pretty text-stone-600">{step.body}</p>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="mx-auto flex w-full max-w-md flex-col items-center gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2" aria-label={`Step ${index + 1} of ${STEPS.length}`} role="img">
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
              Back
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => (isLast ? onDone() : setIndex(index + 1))}
          >
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </div>
      </footer>
    </div>
  )
}
