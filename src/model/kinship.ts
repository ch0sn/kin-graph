import {
  ancestorsOf,
  getPerson,
  isHalf,
  partnerIdsOf,
  partnershipBetween,
  siblingsOf,
  stepParentIdsOf,
} from './queries'
import type { FamilyGraph, Gender, PartnershipStatus, PersonId } from './types'

/**
 * A blood relationship, measured through the closest common ancestor:
 * `up` generations from the first person to the ancestor, `down` from the
 * ancestor to the second person. A parent is up 1/down 0, a sibling 1/1, a
 * first cousin 2/2.
 */
export interface BloodKinship {
  type: 'blood'
  up: number
  down: number
  half: boolean
}

export type Kinship =
  | { type: 'self' }
  | BloodKinship
  | { type: 'partner'; status: PartnershipStatus }
  | { type: 'step-parent' }
  | { type: 'step-child' }
  | { type: 'step-sibling' }
  /** The partner of a blood relative, e.g. a son-in-law or an aunt by marriage. */
  | { type: 'relatives-partner'; relativeId: PersonId; relative: BloodKinship }
  /** A blood relative of a partner, e.g. a mother-in-law. */
  | { type: 'partners-relative'; partnerId: PersonId; relative: BloodKinship }

/** How `toId` is related to `fromId`, or null if they aren't related. */
export function kinship(graph: FamilyGraph, fromId: PersonId, toId: PersonId): Kinship | null {
  if (fromId === toId) return { type: 'self' }

  const partnership = partnershipBetween(graph, fromId, toId)
  if (partnership) return { type: 'partner', status: partnership.status }

  const blood = bloodKinship(graph, fromId, toId)
  if (blood) return blood

  if (stepParentIdsOf(graph, fromId).includes(toId)) return { type: 'step-parent' }
  if (stepParentIdsOf(graph, toId).includes(fromId)) return { type: 'step-child' }
  if (siblingsOf(graph, fromId).some((s) => s.id === toId && s.type === 'step')) {
    return { type: 'step-sibling' }
  }

  const viaRelative = closest(
    partnerIdsOf(graph, toId, { ongoingOnly: true }).map((relativeId) => ({
      relativeId,
      relative: bloodKinship(graph, fromId, relativeId),
    })),
  )
  if (viaRelative) return { type: 'relatives-partner', ...viaRelative }

  const viaPartner = closest(
    partnerIdsOf(graph, fromId, { ongoingOnly: true }).map((partnerId) => ({
      partnerId,
      relative: bloodKinship(graph, partnerId, toId),
    })),
  )
  if (viaPartner) return { type: 'partners-relative', ...viaPartner }

  return null
}

export function bloodKinship(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
): BloodKinship | null {
  const fromAncestors = ancestorsOf(graph, fromId)
  const toAncestors = ancestorsOf(graph, toId)

  let best: { up: number; down: number; fromVia?: PersonId; toVia?: PersonId } | null = null
  for (const [id, fromLineage] of fromAncestors) {
    const toLineage = toAncestors.get(id)
    if (!toLineage) continue
    if (!best || fromLineage.distance + toLineage.distance < best.up + best.down) {
      best = {
        up: fromLineage.distance,
        down: toLineage.distance,
        fromVia: fromLineage.via,
        toVia: toLineage.via,
      }
    }
  }
  if (!best) return null

  // Half relations branch from siblings who share only one parent: the
  // children of the common ancestor on each side.
  const half =
    best.fromVia !== undefined &&
    best.toVia !== undefined &&
    isHalf(graph, best.fromVia, best.toVia)
  return { type: 'blood', up: best.up, down: best.down, half }
}

/** How `toId` is related to `fromId` (the manager by default), in English. */
export function relationshipLabel(
  graph: FamilyGraph,
  toId: PersonId,
  fromId: PersonId = graph.managerId,
): string | null {
  const k = kinship(graph, fromId, toId)
  return k && describeKinship(graph, fromId, toId, k)
}

export function describeKinship(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
  k: Kinship,
): string {
  const gender = getPerson(graph, toId).gender
  return capitalize(describe())

  function describe(): string {
    switch (k.type) {
      case 'self':
        return fromId === graph.managerId ? 'You' : 'Self'
      case 'blood':
        return bloodLabel(k, gender)
      case 'partner':
        return partnerLabel(k.status, gender)
      case 'step-parent':
        return gendered(gender, 'stepmother', 'stepfather', 'step-parent')
      case 'step-child':
        return gendered(gender, 'stepdaughter', 'stepson', 'stepchild')
      case 'step-sibling':
        return gendered(gender, 'stepsister', 'stepbrother', 'step-sibling')
      case 'relatives-partner': {
        const { up, down } = k.relative
        if (up === 0 || (up === 1 && down === 1)) {
          return `${bloodLabel({ ...k.relative, half: false }, gender)}-in-law`
        }
        if (down === 0) return `step-${bloodLabel(k.relative, gender)}`
        if (down === 1) return bloodLabel({ ...k.relative, half: false }, gender)
        const relative = getPerson(graph, k.relativeId)
        const status = partnershipBetween(graph, k.relativeId, toId)?.status ?? 'partnered'
        return `${bloodLabel(k.relative, relative.gender)}'s ${partnerLabel(status, gender)}`
      }
      case 'partners-relative': {
        const { up, down } = k.relative
        if (down === 0 || (up === 1 && down === 1)) {
          return `${bloodLabel({ ...k.relative, half: false }, gender)}-in-law`
        }
        if (up === 0) return `step-${bloodLabel(k.relative, gender)}`
        const partner = getPerson(graph, k.partnerId)
        const status = partnershipBetween(graph, fromId, k.partnerId)?.status ?? 'partnered'
        return `${partnerLabel(status, partner.gender)}'s ${bloodLabel(k.relative, gender)}`
      }
    }
  }
}

function bloodLabel({ up, down, half }: BloodKinship, gender?: Gender): string {
  const halfPrefix = half ? 'half-' : ''
  if (up === 0 && down === 0) return 'self'
  if (down === 0) return lineal(up, gender, 'mother', 'father', 'parent')
  if (up === 0) return lineal(down, gender, 'daughter', 'son', 'child')
  if (up === 1 && down === 1) {
    return halfPrefix + gendered(gender, 'sister', 'brother', 'sibling')
  }
  if (down === 1) {
    return halfPrefix + greats(up - 2) + gendered(gender, 'aunt', 'uncle', 'aunt/uncle')
  }
  if (up === 1) {
    return halfPrefix + greats(down - 2) + gendered(gender, 'niece', 'nephew', 'niece/nephew')
  }
  const degree = Math.min(up, down) - 1
  const removed = Math.abs(up - down)
  return [ordinalWord(degree), 'cousin', removedPhrase(removed)].filter(Boolean).join(' ')
}

/** Parent, grandparent, great-grandparent, 2nd great-grandparent, … */
function lineal(
  generations: number,
  gender: Gender | undefined,
  female: string,
  male: string,
  neutral: string,
): string {
  const base = gendered(gender, female, male, neutral)
  if (generations === 1) return base
  return `${greats(generations - 2)}grand${base}`
}

function greats(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return 'great-'
  return `${ordinalNumber(count)} great-`
}

function partnerLabel(status: PartnershipStatus, gender?: Gender): string {
  const spouse = gendered(gender, 'wife', 'husband', 'spouse')
  switch (status) {
    case 'married':
      return spouse
    case 'partnered':
      return 'partner'
    case 'separated':
      return 'ex-partner'
    case 'divorced':
      return `ex-${spouse}`
    case 'widowed':
      return `late ${spouse}`
  }
}

function gendered(gender: Gender | undefined, female: string, male: string, neutral: string) {
  return gender === 'female' ? female : gender === 'male' ? male : neutral
}

const ORDINAL_WORDS = [
  '',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
]

function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? ordinalNumber(n)
}

function ordinalNumber(n: number): string {
  const lastTwo = n % 100
  const suffix =
    lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${suffix}`
}

function removedPhrase(removed: number): string {
  if (removed === 0) return ''
  if (removed === 1) return 'once removed'
  if (removed === 2) return 'twice removed'
  return `${removed} times removed`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function closest<T extends { relative: BloodKinship | null }>(
  candidates: T[],
): (T & { relative: BloodKinship }) | null {
  let best: (T & { relative: BloodKinship }) | null = null
  for (const c of candidates) {
    if (!c.relative) continue
    const distance = c.relative.up + c.relative.down
    if (!best || distance < best.relative.up + best.relative.down) {
      best = c as T & { relative: BloodKinship }
    }
  }
  return best
}
