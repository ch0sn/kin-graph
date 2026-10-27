import { t } from '../i18n'
import {
  dateProblem,
  isCertainlyBefore,
  isDeceased,
  type Gender,
  type NameForm,
  type NameType,
  type NewPerson,
  type Person,
  type PersonName,
} from '../model'

/**
 * One name's fields, as entered. The form edits the first and last name;
 * everything else about the name is kept as it was.
 */
export interface NameValues {
  /** Identifies the name in lists while it's edited. */
  key: string
  type: NameType | ''
  given: string
  /** All surnames, separated by spaces. */
  surname: string
  /** The surnames as stored, kept apart (García, López) unless `surname` is changed. */
  surnameParts?: string[]
  patronymic?: string
  from?: string
  to?: string
  forms?: NameForm[]
}

/** The person form's fields, as entered. The first name is the one shown. */
export interface PersonValues {
  names: [NameValues, ...NameValues[]]
  gender: Gender | ''
  birthDate: string
  deceased: boolean
  /** Only used when `deceased` is ticked. */
  deathDate: string
  /** The stored photo, or '' for none. A newly chosen photo is stored on submit. */
  photoId: string
}

export type PersonErrors = Partial<Record<'givenName' | 'birthDate' | 'deathDate', string>>

let lastKey = 0
const newKey = () => `name-${++lastKey}`

export function emptyName(overrides: Partial<NameValues> = {}): NameValues {
  return { key: newKey(), type: '', given: '', surname: '', ...overrides }
}

export function emptyValues(overrides: Partial<PersonValues> = {}): PersonValues {
  return {
    names: [emptyName()],
    gender: '',
    birthDate: '',
    deceased: false,
    deathDate: '',
    photoId: '',
    ...overrides,
  }
}

export function nameValues(name: PersonName): NameValues {
  return emptyName({
    type: name.type ?? '',
    given: name.given,
    surname: name.surnames?.join(' ') ?? '',
    surnameParts: name.surnames,
    patronymic: name.patronymic,
    from: name.from,
    to: name.to,
    forms: name.forms,
  })
}

export function valuesFromPerson(person: Person): PersonValues {
  const [shown, ...others] = person.names.map(nameValues)
  return {
    names: [shown, ...others],
    gender: person.gender ?? '',
    birthDate: person.birthDate ?? '',
    deceased: isDeceased(person),
    deathDate: person.deathDate ?? '',
    photoId: person.photoId ?? '',
  }
}

/** The message for a date that can't be used, if any. */
export function dateError(text: string): string | undefined {
  const problem = text ? dateProblem(text) : null
  if (!problem) return undefined
  return problem === 'rangeOrder' ? t('v.rangeOrder') : t('v.dateHint')
}

export function validate(values: PersonValues): PersonErrors {
  const errors: PersonErrors = {}
  const birth = values.birthDate.trim()
  const death = values.deceased ? values.deathDate.trim() : ''
  if (!values.names[0].given.trim()) errors.givenName = t('v.firstNeeded')
  errors.birthDate = dateError(birth)
  errors.deathDate = dateError(death)
  // Only a death that is certainly earlier than the birth is an error; imprecise dates may overlap.
  if (!errors.birthDate && !errors.deathDate && birth && death && isCertainlyBefore(death, birth)) {
    errors.deathDate = t('v.deathBeforeBirth')
  }
  for (const key of Object.keys(errors) as (keyof PersonErrors)[]) {
    if (errors[key] === undefined) delete errors[key]
  }
  return errors
}

const optional = (text: string) => text.trim() || undefined

/** A name from its fields, or null when nothing was entered. Blank fields are left out. */
export function toPersonName(values: NameValues): PersonName | null {
  const surname = values.surname.trim()
  const unchanged = values.surnameParts && surname === values.surnameParts.join(' ').trim()
  const surnames = unchanged ? values.surnameParts : surname ? [surname] : undefined
  const patronymic = optional(values.patronymic ?? '')
  const given = values.given.trim()
  if (!given && !surnames && !patronymic) return null
  return {
    given,
    ...(surnames && { surnames }),
    ...(patronymic && { patronymic }),
    ...(values.type && { type: values.type }),
    ...(values.from && { from: values.from }),
    ...(values.to && { to: values.to }),
    ...(values.forms?.length && { forms: values.forms }),
  }
}

/**
 * Converts valid form values to person fields. Blank fields become
 * `undefined` so that editing can clear them, and names left empty are
 * dropped.
 */
export function toPersonFields(values: PersonValues): NewPerson {
  const [shown, ...others] = values.names.map(toPersonName)
  // `validate` makes sure the shown name has a given name.
  return {
    names: [shown!, ...others.filter((n): n is PersonName => n !== null)],
    gender: values.gender || undefined,
    birthDate: optional(values.birthDate),
    deceased: values.deceased || undefined,
    deathDate: values.deceased ? optional(values.deathDate) : undefined,
    photoId: values.photoId || undefined,
  }
}
