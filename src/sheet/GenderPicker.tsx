import { Mars, Venus } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { useT } from '../i18n'
import type { Gender } from '../model'

const GENDER_OPTIONS = [
  { value: 'female', label: 'gender.female', Icon: Venus },
  { value: 'male', label: 'gender.male', Icon: Mars },
] as const

/**
 * Female or male. Tapping the selected one again clears it.
 * `icons` is the compact row in the person editor; `cards` is the onboarding step.
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
  const labelId = useId()

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
              animate={{ scale: selected ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={[
                'flex flex-col items-center gap-3 rounded-3xl border px-4 py-8 text-base font-medium',
                'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
                selected
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
              ].join(' ')}
            >
              <Icon className="size-8" strokeWidth={1.5} aria-hidden />
              {t(label)}
            </motion.button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {t('form.gender')}
      </span>
      <div className="flex gap-2">
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
                'flex size-11 items-center justify-center rounded-full border transition active:scale-95',
                'focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
                selected
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800',
              ].join(' ')}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}
