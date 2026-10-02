import { t } from '../i18n'
import {
  displayName,
  isDeceased,
  isFuzzyDate,
  simpleName,
  type Gender,
  type NewPerson,
  type Person,
} from '../model'

/** The person form's fields, as entered. The name fields edit the name that is shown. */
export interface PersonValues {
  givenName: string
  /** All surnames, separated by spaces. */
  familyName: string
  gender: Gender | ''
  birthDate: string
  deceased: boolean
  /** Only used when `deceased` is ticked. */
  deathDate: string
  /** The stored photo, or '' for none. A newly chosen photo is stored on submit. */
  photoId: string
}

export type PersonErrors = Partial<Record<keyof PersonValues, string>>

export function emptyValues(overrides: Partial<PersonValues> = {}): PersonValues {
  return {
    givenName: '',
    familyName: '',
    gender: '',
    birthDate: '',
    deceased: false,
    deathDate: '',
    photoId: '',
    ...overrides,
  }
}

export function valuesFromPerson(person: Person): PersonValues {
  return {
    givenName: displayName(person).given,
    familyName: displayName(person).surnames?.join(' ') ?? '',
    gender: person.gender ?? '',
    birthDate: person.birthDate ?? '',
    deceased: isDeceased(person),
    deathDate: person.deathDate ?? '',
    photoId: person.photoId ?? '',
  }
}

export function validate(values: PersonValues): PersonErrors {
  const errors: PersonErrors = {}
  const birth = values.birthDate.trim()
  const death = values.deceased ? values.deathDate.trim() : ''
  if (!values.givenName.trim()) errors.givenName = t('v.firstNeeded')
  if (birth && !isFuzzyDate(birth)) errors.birthDate = t('v.dateHint')
  if (death && !isFuzzyDate(death)) errors.deathDate = t('v.dateHint')
  if (!errors.birthDate && !errors.deathDate && birth && death) {
    // Compare only as precisely as both dates are known.
    const length = Math.min(birth.length, death.length)
    if (death.slice(0, length) < birth.slice(0, length)) {
      errors.deathDate = t('v.deathBeforeBirth')
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
    names: [simpleName(values.givenName.trim(), optional(values.familyName))],
    gender: values.gender || undefined,
    birthDate: optional(values.birthDate),
    deceased: values.deceased || undefined,
    deathDate: values.deceased ? optional(values.deathDate) : undefined,
    photoId: values.photoId || undefined,
  }
}

/**
 * Edited fields for an existing person, keeping what the form doesn't show:
 * their other names, and the shown name's type, order, dates, other scripts
 * and patronymic. Surnames keep their parts unless the text was changed.
 */
export function keepNameDetails(fields: NewPerson, person: Person): NewPerson {
  const [edited] = fields.names
  const [current, ...others] = person.names
  const surnamesUnchanged = (edited.surnames ?? []).join(' ') === (current.surnames ?? []).join(' ')
  const name = {
    ...current,
    given: edited.given,
    surnames: surnamesUnchanged ? current.surnames : edited.surnames,
  }
  return { ...fields, names: [name, ...others] }
}
