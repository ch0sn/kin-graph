import { isFuzzyDate, type Gender, type NewPerson, type Person } from '../model'

/** The person form's fields, as typed. */
export interface PersonValues {
  givenName: string
  familyName: string
  gender: Gender | ''
  birthDate: string
  deathDate: string
}

export type PersonErrors = Partial<Record<keyof PersonValues, string>>

export function emptyValues(overrides: Partial<PersonValues> = {}): PersonValues {
  return { givenName: '', familyName: '', gender: '', birthDate: '', deathDate: '', ...overrides }
}

export function valuesFromPerson(person: Person): PersonValues {
  return {
    givenName: person.givenName,
    familyName: person.familyName ?? '',
    gender: person.gender ?? '',
    birthDate: person.birthDate ?? '',
    deathDate: person.deathDate ?? '',
  }
}

const DATE_HINT = 'Use YYYY, YYYY-MM or YYYY-MM-DD'

export function validate(values: PersonValues): PersonErrors {
  const errors: PersonErrors = {}
  const birth = values.birthDate.trim()
  const death = values.deathDate.trim()
  if (!values.givenName.trim()) errors.givenName = 'A first name is needed'
  if (birth && !isFuzzyDate(birth)) errors.birthDate = DATE_HINT
  if (death && !isFuzzyDate(death)) errors.deathDate = DATE_HINT
  if (!errors.birthDate && !errors.deathDate && birth && death) {
    // Compare only as precisely as both dates are known.
    const length = Math.min(birth.length, death.length)
    if (death.slice(0, length) < birth.slice(0, length)) {
      errors.deathDate = 'Can’t be before the birth date'
    }
  }
  return errors
}

/**
 * Converts valid form values to person fields. Blank fields become
 * `undefined` so that editing can clear them.
 */
export function toPersonFields(values: PersonValues): NewPerson {
  const optional = (text: string) => text.trim() || undefined
  return {
    givenName: values.givenName.trim(),
    familyName: optional(values.familyName),
    gender: values.gender || undefined,
    birthDate: optional(values.birthDate),
    deathDate: optional(values.deathDate),
  }
}
