import { dateBounds } from './dates'
import { isDeceased } from './format'
import { partnershipsOf } from './queries'
import type { FamilyGraph, FuzzyDate, Partnership, Person, PersonId } from './types'

/**
 * Things in a tree that can't be right, or very likely aren't. Dates are
 * often only partly known, so a date problem is only reported when every day
 * the dates could mean is wrong: "1950" and "1950-06" never clash.
 */
export type IssueKind =
  | 'deathBeforeBirth'
  /** Lived longer than `MAX_AGE` years. */
  | 'tooOld'
  /** Born more than `MAX_AGE` years ago and not known to have died. */
  | 'tooOldToBeLiving'
  | 'parentBornAfterChild'
  | 'parentTooYoung'
  | 'parentTooOld'
  | 'bornAfterMotherDied'
  /** Born more than `AFTER_FATHER_MONTHS` after a parent other than the mother died. */
  | 'bornAfterFatherDied'
  | 'partnershipBeforeBirth'
  | 'partnershipAfterDeath'
  | 'partnershipEndsBeforeStart'
  | 'overlappingPartnerships'
  | 'ownParent'
  | 'ownPartner'
  | 'ancestryCycle'
  | 'possibleDuplicate'
  /** A placeholder parent that no longer links two children. */
  | 'orphanedPlaceholder'

/** `error`: can't be true as recorded. `warning`: possible, but worth a second look. */
export type IssueSeverity = 'error' | 'warning'

export interface TreeIssue {
  /** Stays the same while the problem does, so it can be ignored for good. */
  id: string
  kind: IssueKind
  severity: IssueSeverity
  /** Who it's about, the person it's mainly about first. */
  personIds: PersonId[]
}

/** Longer than anyone is known to have lived. */
export const MAX_AGE = 120
/** Younger than this at a child's birth is very unlikely. */
export const MIN_PARENT_AGE = 12
/** Older than this at a child's birth is very unlikely. */
export const MAX_MOTHER_AGE = 60
export const MAX_FATHER_AGE = 80
/** A father can die before his child is born; allow a long pregnancy. */
export const AFTER_FATHER_MONTHS = 10

const SEVERITY: Record<IssueKind, IssueSeverity> = {
  deathBeforeBirth: 'error',
  tooOld: 'warning',
  tooOldToBeLiving: 'warning',
  parentBornAfterChild: 'error',
  parentTooYoung: 'warning',
  parentTooOld: 'warning',
  bornAfterMotherDied: 'error',
  bornAfterFatherDied: 'error',
  partnershipBeforeBirth: 'error',
  partnershipAfterDeath: 'error',
  partnershipEndsBeforeStart: 'error',
  overlappingPartnerships: 'warning',
  ownParent: 'error',
  ownPartner: 'error',
  ancestryCycle: 'error',
  possibleDuplicate: 'warning',
  orphanedPlaceholder: 'warning',
}

/** Every problem found in the tree, errors first. */
export function checkTree(graph: FamilyGraph, { today = new Date() }: { today?: Date } = {}): TreeIssue[] {
  const issues = new Map<string, TreeIssue>()
  const add = (kind: IssueKind, personIds: PersonId[], key = personIds.join(',')) => {
    const id = `${kind}:${key}`
    if (!issues.has(id)) issues.set(id, { id, kind, severity: SEVERITY[kind], personIds })
  }
  const people = Object.values(graph.people)
  const todayIso = isoDay(today)

  for (const person of people) {
    if (person.isPlaceholder) continue
    const { birthDate: birth, deathDate: death } = person
    if (birth && death && certainlyBefore(death, birth)) add('deathBeforeBirth', [person.id])
    else if (birth && death && certainlyMoreYearsApart(birth, death, MAX_AGE)) add('tooOld', [person.id])
    if (birth && !isDeceased(person)) {
      const latestBirth = dateBounds(birth)?.to
      if (latestBirth && latestBirth < shiftIso(todayIso, -MAX_AGE * 12)) add('tooOldToBeLiving', [person.id])
    }
  }

  for (const link of graph.parentLinks) {
    if (link.parentId === link.childId) {
      add('ownParent', [link.childId])
      continue
    }
    const parent = graph.people[link.parentId]
    const child = graph.people[link.childId]
    if (!parent || !child || link.kind !== 'biological') continue
    const ids = [child.id, parent.id]
    const { birthDate: born } = child
    if (!born) continue
    if (parent.birthDate) {
      if (certainlyBefore(born, parent.birthDate)) add('parentBornAfterChild', ids)
      else if (certainlyFewerYearsApart(parent.birthDate, born, MIN_PARENT_AGE)) add('parentTooYoung', ids)
      else {
        const maxAge = parent.gender === 'female' ? MAX_MOTHER_AGE : MAX_FATHER_AGE
        if (certainlyMoreYearsApart(parent.birthDate, born, maxAge)) add('parentTooOld', ids)
      }
    }
    if (parent.deathDate) {
      if (parent.gender === 'female') {
        if (certainlyBefore(parent.deathDate, born)) add('bornAfterMotherDied', ids)
      } else {
        const latestDeath = dateBounds(parent.deathDate)?.to
        const earliestBirth = dateBounds(born)?.from
        if (latestDeath && earliestBirth && shiftIso(latestDeath, AFTER_FATHER_MONTHS) < earliestBirth) {
          add('bornAfterFatherDied', ids)
        }
      }
    }
  }

  for (const partnership of graph.partnerships) {
    const [a, b] = partnership.partnerIds
    if (a === b) {
      add('ownPartner', [a])
      continue
    }
    const { startDate: start, endDate: end } = partnership
    if (start && end && certainlyBefore(end, start)) add('partnershipEndsBeforeStart', [a, b], partnership.id)
    for (const id of [a, b]) {
      const person = graph.people[id]
      if (!person) continue
      const other = id === a ? b : a
      const dates = [start, end].filter((d): d is FuzzyDate => Boolean(d))
      if (person.birthDate && dates.some((d) => certainlyBefore(d, person.birthDate!))) {
        add('partnershipBeforeBirth', [id, other], `${id}:${partnership.id}`)
      }
      if (person.deathDate && dates.some((d) => certainlyBefore(person.deathDate!, d))) {
        add('partnershipAfterDeath', [id, other], `${id}:${partnership.id}`)
      }
    }
  }

  for (const person of people) {
    const partnerships = partnershipsOf(graph, person.id).filter((p) => p.partnerIds[0] !== p.partnerIds[1])
    for (let i = 0; i < partnerships.length; i++) {
      for (let j = i + 1; j < partnerships.length; j++) {
        if (!certainlyOverlap(graph, partnerships[i], partnerships[j])) continue
        const others = [partnerships[i], partnerships[j]].map((p) => p.partnerIds.find((id) => id !== person.id)!)
        add('overlappingPartnerships', [person.id, ...others], [person.id, ...[...others].sort()].join(','))
      }
    }
  }

  for (const cycle of ancestryCycles(graph)) add('ancestryCycle', cycle, [...cycle].sort().join(','))

  const byNameAndBirth = new Map<string, PersonId[]>()
  for (const person of people) {
    if (person.isPlaceholder || !person.birthDate) continue
    const key = `${nameKey(person)}|${person.birthDate}`
    byNameAndBirth.set(key, [...(byNameAndBirth.get(key) ?? []), person.id])
  }
  for (const ids of byNameAndBirth.values()) {
    if (ids.length > 1) add('possibleDuplicate', ids, [...ids].sort().join(','))
  }

  for (const person of people) {
    if (!person.isPlaceholder) continue
    const children = graph.parentLinks.filter((l) => l.parentId === person.id).length
    if (children < 2) add('orphanedPlaceholder', [person.id])
  }

  const rank = (issue: TreeIssue) => (issue.severity === 'error' ? 0 : 1)
  return [...issues.values()].sort((x, y) => rank(x) - rank(y))
}

/** The people an issue that isn't ignored is about. */
export function flaggedPeople(issues: readonly TreeIssue[]): Set<PersonId> {
  return new Set(issues.flatMap((issue) => issue.personIds))
}

// --- Dates ------------------------------------------------------------------

/** Every day `a` could be is before every day `b` could be. */
function certainlyBefore(a: FuzzyDate, b: FuzzyDate): boolean {
  const to = dateBounds(a)?.to
  const from = dateBounds(b)?.from
  return Boolean(to && from && to < from)
}

/** `later` is certainly more than `years` after `earlier`. */
function certainlyMoreYearsApart(earlier: FuzzyDate, later: FuzzyDate, years: number): boolean {
  const to = dateBounds(earlier)?.to
  const from = dateBounds(later)?.from
  return Boolean(to && from && shiftIso(to, years * 12) < from)
}

/** `later` is certainly fewer than `years` after `earlier`. */
function certainlyFewerYearsApart(earlier: FuzzyDate, later: FuzzyDate, years: number): boolean {
  const from = dateBounds(earlier)?.from
  const to = dateBounds(later)?.to
  return Boolean(from && to && to < shiftIso(from, years * 12))
}

/**
 * Moves an ISO day by whole months, keeping the day of the month. The result
 * may be a day that doesn't exist, like 1951-02-30, which still compares
 * correctly with real days as text.
 */
function shiftIso(iso: string, months: number): string {
  const [year, month] = iso.split('-').map(Number)
  const total = year * 12 + (month - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}${iso.slice(7)}`
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface Span {
  /** The last day it could have started on. */
  startedBy: string
  /** The first day it could have ended on; unset while it's still going on. */
  endedFrom?: string
}

/**
 * When a partnership certainly ran: from its start to its end, or to a
 * partner's death. Null when that isn't known, e.g. a divorce without a date.
 */
function spanOf(graph: FamilyGraph, partnership: Partnership): Span | null {
  const startedBy = partnership.startDate && dateBounds(partnership.startDate)?.to
  if (!startedBy) return null
  if (partnership.endDate) {
    const endedFrom = dateBounds(partnership.endDate)?.from
    return endedFrom ? { startedBy, endedFrom } : null
  }
  const partners = partnership.partnerIds.map((id) => graph.people[id]).filter((p): p is Person => Boolean(p))
  const deaths = partners.flatMap((p) => (p.deathDate ? [dateBounds(p.deathDate)?.from] : []))
  if (deaths.length > 0) {
    // Whoever died first ended it; without a lower bound on that, nothing is certain.
    if (deaths.some((d) => !d)) return null
    return { startedBy, endedFrom: deaths.sort()[0] }
  }
  const ongoing = partnership.status === 'married' || partnership.status === 'partnered'
  return ongoing && !partners.some(isDeceased) ? { startedBy } : null
}

function certainlyOverlap(graph: FamilyGraph, x: Partnership, y: Partnership): boolean {
  const a = spanOf(graph, x)
  const b = spanOf(graph, y)
  if (!a || !b) return false
  const beforeEnd = (start: string, span: Span) => span.endedFrom === undefined || start < span.endedFrom
  return beforeEnd(a.startedBy, b) && beforeEnd(b.startedBy, a)
}

// --- Other helpers ------------------------------------------------------------

/** A name as it would be compared for duplicates, whatever order it's written in. */
function nameKey(person: Person): string {
  const { given, surnames = [], patronymic = '' } = person.names[0]
  return [given, patronymic, ...surnames].join(' ').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

/** Groups of people who are each other's ancestors, which can't be. */
function ancestryCycles(graph: FamilyGraph): PersonId[][] {
  // Tarjan's strongly connected components over parent → child links.
  const children = new Map<PersonId, PersonId[]>()
  for (const { parentId, childId } of graph.parentLinks) {
    if (parentId === childId) continue
    children.set(parentId, [...(children.get(parentId) ?? []), childId])
  }
  const index = new Map<PersonId, number>()
  const low = new Map<PersonId, number>()
  const onStack = new Set<PersonId>()
  const stack: PersonId[] = []
  const cycles: PersonId[][] = []
  let next = 0

  const visit = (id: PersonId) => {
    index.set(id, next)
    low.set(id, next)
    next++
    stack.push(id)
    onStack.add(id)
    for (const child of children.get(id) ?? []) {
      if (!index.has(child)) {
        visit(child)
        low.set(id, Math.min(low.get(id)!, low.get(child)!))
      } else if (onStack.has(child)) {
        low.set(id, Math.min(low.get(id)!, index.get(child)!))
      }
    }
    if (low.get(id) === index.get(id)) {
      const component: PersonId[] = []
      let member: PersonId
      do {
        member = stack.pop()!
        onStack.delete(member)
        component.push(member)
      } while (member !== id)
      if (component.length > 1) cycles.push(component.reverse())
    }
  }

  for (const id of children.keys()) if (!index.has(id)) visit(id)
  return cycles
}
