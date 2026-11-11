import { Mars, Venus } from 'lucide-react'
import { motion } from 'motion/react'
import { useT } from '../i18n'
import type { Gender } from '../model'

const GENDER_OPTIONS = [
  { value: 'female', label: 'gender.female', Icon: Venus },
  { value: 'male', label: 'gender.male', Icon: Mars },
] as const

/**
 * Female or male. Tapping the selected one again clears it.
 * `icons` is the compact row in the person editor: no label, and a choice
 * colors only that icon (red for female, blue for male). `cards` is the onboarding step.
 */
export function GenderPicker({
  value,
  onChange,
  variant = 'icons',
}: {
  value: Gender | ''
  onChange: (value: Gender | '') => void
  variant?: 'icons' | 'cards'
}) {
  const { t } = useT()

  if (variant === 'cards') {
    return (
      <div role="group" aria-label={t('form.gender')} className="grid grid-cols-2 gap-3">
        {GENDER_OPTIONS.map(({ value: option, label, Icon }) => {
          const selected = value === option
          return (
            <motion.button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? '' : option)}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={[
                'flex min-w-0 flex-col items-center gap-3 rounded-3xl border px-4 py-8 text-base font-medium',
                'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:ring-inset focus-visible:outline-none',
                selected
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
              ].join(' ')}
            >
              <motion.span
                animate={{ scale: selected ? 1.08 : 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex"
              >
                <Icon className="size-8" strokeWidth={1.5} aria-hidden />
              </motion.span>
              {t(label)}
            </motion.button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="group" aria-label={t('form.gender')} className="flex gap-2">
      {GENDER_OPTIONS.map(({ value: option, label, Icon }) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            aria-label={t(label)}
            aria-pressed={selected}
            title={t(label)}
            onClick={() => onChange(selected ? '' : option)}
            className={[
              'flex size-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition active:scale-95',
              'hover:border-stone-300 hover:text-stone-800',
              'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
            ].join(' ')}
          >
            <Icon
              className={`size-5 ${selected ? (option === 'female' ? 'text-red-500' : 'text-blue-500') : ''}`}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
