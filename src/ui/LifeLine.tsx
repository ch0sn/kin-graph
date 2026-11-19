import { Cake, Cross } from 'lucide-react'
import { useT, type MessageKey, type Params } from '../i18n'
import {
  ageOf,
  formatAge,
  formatFuzzyDate,
  isDeceased,
  lifeYears,
  type Person,
} from '../model'

type Translate = (key: MessageKey, params?: Params) => string

interface LifeLineProps {
  person: Person
  /** Hide dates and render nothing when the age is unknown. */
  ageOnly?: boolean
  className?: string
}

/**
 * A person's age with an icon: a cake and their age today ("🎂 38"), or a
 * cross and the age they reached ("✝ 81"). The dates show on hover. When
 * the age can't be worked out, whatever dates are known show instead.
 */
export function LifeLine({ person, ageOnly = false, className = '' }: LifeLineProps) {
  const { t } = useT()
  const deceased = isDeceased(person)
  const age = ageOf(person)
  const Icon = deceased ? Cross : Cake
  const dates = ageOnly ? null : datesText(person, t)

  if (ageOnly && !age) return null

  if (!age && !deceased) {
    const years = lifeYears(person)
    return years ? <p className={`text-stone-500 tabular-nums ${className}`}>{years}</p> : null
  }

  return (
    <p
      title={dates ?? undefined}
      className={`flex items-center gap-1 text-stone-500 tabular-nums ${className}`}
    >
      <Icon className="size-[1.1em] shrink-0" aria-hidden />
      {age ? (
        <>
          <span className="sr-only">{deceased ? t('life.diedAged') : t('life.age')}</span>
          {formatAge(age)}
        </>
      ) : (
        <>
          <span className="sr-only">{t('life.died')}</span>
          {lifeYears(person)}
        </>
      )}
    </p>
  )
}

/** "Born June 12, 1988", or "May 19, 1934 – 2015" for someone who has died. */
function datesText(person: Person, t: Translate): string | null {
  const born = person.birthDate && formatFuzzyDate(person.birthDate)
  const died = person.deathDate && formatFuzzyDate(person.deathDate)
  if (!isDeceased(person)) return born ? t('life.bornOn', { date: born }) : null
  if (born && died) return `${born} – ${died}`
  if (died) return t('life.diedOn', { date: died })
  return born ? t('life.bornOn', { date: born }) : null
}
