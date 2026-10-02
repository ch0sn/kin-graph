export type PersonId = string

export type Gender = 'female' | 'male' | 'other'

/**
 * Genealogical dates are often only partly known, so dates are ISO-8601
 * strings at year, month or day precision: "1950", "1950-03", "1950-03-14".
 */
export type FuzzyDate = string

export interface Person {
  id: PersonId
  givenName: string
  familyName?: string
  gender?: Gender
  birthDate?: FuzzyDate
  deathDate?: FuzzyDate
  /** Known to have died, even if the date isn't known. Implied by `deathDate`. */
  deceased?: boolean
  /** A photo kept in the device's photo store; see `src/storage/photos.ts`. */
  photoId?: string
  /**
   * Stands in for a parent who isn't recorded yet, so that siblings can be
   * linked through them. Filled in place when the real parent is added.
   */
  isPlaceholder?: boolean
}

export type NewPerson = Omit<Person, 'id'>

/**
 * How a parent is related to a child. Step-parents aren't stored: they are
 * derived from a parent's partnerships (see `stepParentsOf`).
 */
export type ParentKind = 'biological' | 'adoptive' | 'foster'

export interface ParentLink {
  parentId: PersonId
  childId: PersonId
  kind: ParentKind
}

export type PartnershipStatus =
  | 'married'
  | 'partnered'
  | 'separated'
  | 'divorced'
  | 'widowed'

export interface Partnership {
  id: string
  partnerIds: [PersonId, PersonId]
  status: PartnershipStatus
  startDate?: FuzzyDate
  endDate?: FuzzyDate
}

/**
 * A family tree as seen by its manager. The manager is the root every
 * relationship label is computed from. Siblings, step-relations and in-laws
 * are derived from parent links and partnerships rather than stored.
 */
export interface FamilyGraph {
  managerId: PersonId
  people: Record<PersonId, Person>
  parentLinks: ParentLink[]
  partnerships: Partnership[]
}
