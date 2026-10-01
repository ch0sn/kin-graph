import { Cake, Cross } from 'lucide-react'
import {
  ageOf,
  formatAge,
  formatFuzzyDate,
  isDeceased,
  lifeYears,
  type Person,
} from '../model'

interface LifeLineProps {
  person: Person
  /** Also spells out the dates, e.g. in the person sheet. */
  detailed?: boolean
  className?: string
}

/**
 * A person's age with an icon: a cake and their age today ("🎂 38"), or a
 * cross and the age they reached ("✝ 81"). The dates show on hover. When
 * the age can't be worked out, whatever dates are known show instead.
 */
export function LifeLine({ person, detailed = false, className = '' }: LifeLineProps) {
  const deceased = isDeceased(person)
  const age = ageOf(person)
  const Icon = deceased ? Cross : Cake
  const dates = datesText(person)

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
          <span className="sr-only">{deceased ? 'Died aged ' : 'Age '}</span>
          {formatAge(age)}
          {detailed && dates && <span className="text-stone-400">&nbsp;· {dates}</span>}
        </>
      ) : (
        <>
          <span className="sr-only">Died </span>
          {lifeYears(person)}
        </>
      )}
    </p>
  )
}

/** "Born June 12, 1988", or "May 19, 1934 – 2015" for someone who has died. */
function datesText(person: Person): string | null {
  const born = person.birthDate && formatFuzzyDate(person.birthDate)
  const died = person.deathDate && formatFuzzyDate(person.deathDate)
  if (!isDeceased(person)) return born ? `Born ${born}` : null
  if (born && died) return `${born} – ${died}`
  if (died) return `Died ${died}`
  return born ? `Born ${born}` : null
}
