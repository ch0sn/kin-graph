import { Cake } from 'lucide-react'
import { ageOf, formatAge, formatFuzzyDate, lifeYears, type Person } from '../model'

interface LifeLineProps {
  person: Person
  /** Also spells out the birth date, e.g. in the person sheet. */
  detailed?: boolean
  className?: string
}

/**
 * A living person's age with a cake icon ("🎂 38"), or the years of someone
 * who has died ("1934 – 2015"). The exact birth date shows on hover.
 */
export function LifeLine({ person, detailed = false, className = '' }: LifeLineProps) {
  const age = ageOf(person)
  const base = `text-stone-500 tabular-nums ${className}`

  if (age && person.birthDate) {
    const born = formatFuzzyDate(person.birthDate)
    return (
      <p title={`Born ${born}`} className={`flex items-center gap-1 ${base}`}>
        <Cake className="size-[1.1em] shrink-0" aria-hidden />
        <span className="sr-only">Age </span>
        {formatAge(age)}
        {detailed && <span className="text-stone-400">&nbsp;· Born {born}</span>}
      </p>
    )
  }

  const years = lifeYears(person)
  return years ? <p className={base}>{years}</p> : null
}
