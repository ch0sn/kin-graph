import { getPerson, partnershipBetween } from './queries'
import type { BloodKinship, Kinship } from './kinship'
import type { FamilyGraph, Gender, PartnershipStatus, PersonId } from './types'

/**
 * German relationship labels. German builds many of these as compound words
 * (Urgroßmutter, Halbbruder, Schwiegersohn), so they're assembled here rather
 * than translated from the English pieces.
 */
export function describeKinshipDe(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
  k: Kinship,
): string {
  const gender = getPerson(graph, toId).gender

  switch (k.type) {
    case 'self':
      return fromId === graph.managerId ? 'Du' : 'Selbst'
    case 'blood':
      return bloodLabel(k, gender)
    case 'partner':
      return partnerLabel(k.status, gender)
    case 'step-parent':
      return pick(gender, 'Stiefmutter', 'Stiefvater', 'Stiefelternteil')
    case 'step-child':
      return pick(gender, 'Stieftochter', 'Stiefsohn', 'Stiefkind')
    case 'step-sibling':
      return pick(gender, 'Stiefschwester', 'Stiefbruder', 'Stiefgeschwister')
    case 'relatives-partner': {
      const { up, down } = k.relative
      if (up === 0 || (up === 1 && down === 1)) return inLaw(k.relative, gender)
      if (down === 0) return `Stief${lowerFirst(bloodLabel(k.relative, gender))}`
      if (down === 1) return bloodLabel({ ...k.relative, half: false }, gender)
      const relative = getPerson(graph, k.relativeId)
      const status = partnershipBetween(graph, k.relativeId, toId)?.status ?? 'partnered'
      return `${partnerLabel(status, gender)} von ${bloodLabel(k.relative, relative.gender)}`
    }
    case 'partners-relative': {
      const { up, down } = k.relative
      if (down === 0 || (up === 1 && down === 1)) return inLaw(k.relative, gender)
      if (up === 0) return `Stief${lowerFirst(bloodLabel(k.relative, gender))}`
      const partner = getPerson(graph, k.partnerId)
      const status = partnershipBetween(graph, fromId, k.partnerId)?.status ?? 'partnered'
      return `${bloodLabel(k.relative, gender)} (${partnerLabel(status, partner.gender)}-Seite)`
    }
  }
}

function pick(gender: Gender | undefined, female: string, male: string, neutral: string) {
  return gender === 'female' ? female : gender === 'male' ? male : neutral
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** "Ur" for each generation beyond great: Großmutter, Urgroßmutter, Ururgroßmutter. */
function urPrefix(generations: number): string {
  return 'Ur'.repeat(Math.max(generations, 0))
}

function bloodLabel({ up, down, half }: BloodKinship, gender?: Gender): string {
  const halfPrefix = half ? 'Halb' : ''
  const withHalf = (word: string) => (half ? halfPrefix + lowerFirst(word) : word)

  if (up === 0 && down === 0) return 'Selbst'

  if (down === 0) {
    if (up === 1) return pick(gender, 'Mutter', 'Vater', 'Elternteil')
    const grand = pick(gender, 'Großmutter', 'Großvater', 'Großelternteil')
    return up === 2 ? grand : urPrefix(up - 2) + lowerFirst(grand)
  }
  if (up === 0) {
    if (down === 1) return pick(gender, 'Tochter', 'Sohn', 'Kind')
    if (down === 2) return pick(gender, 'Enkelin', 'Enkel', 'Enkelkind')
    return urPrefix(down - 2) + lowerFirst(pick(gender, 'Enkelin', 'Enkel', 'Enkelkind'))
  }
  if (up === 1 && down === 1) return withHalf(pick(gender, 'Schwester', 'Bruder', 'Geschwister'))

  if (down === 1) {
    const base = pick(gender, 'Tante', 'Onkel', 'Tante/Onkel')
    return withHalf(up === 2 ? base : greatPrefix(up - 2) + lowerFirst(base))
  }
  if (up === 1) {
    const base = pick(gender, 'Nichte', 'Neffe', 'Nichte/Neffe')
    return withHalf(down === 2 ? base : greatPrefix(down - 2) + lowerFirst(base))
  }

  const degree = Math.min(up, down) - 1
  const removed = Math.abs(up - down)
  const cousin = pick(gender, 'Cousine', 'Cousin', 'Cousin/Cousine')
  const parts = [degree === 1 ? cousin : `${cousin} ${degree}. Grades`]
  if (removed > 0) {
    parts.push(`(${removed} ${removed === 1 ? 'Generation' : 'Generationen'} versetzt)`)
  }
  return parts.join(' ')
}

/** Groß, Urgroß, Ururgroß for aunts, uncles, nieces and nephews. */
function greatPrefix(steps: number): string {
  return steps <= 1 ? 'Groß' : `${urPrefix(steps - 1)}groß`
}

/** Relatives by marriage: Schwiegermutter, Schwager, or "… (angeheiratet)" for others. */
function inLaw(relative: BloodKinship, gender?: Gender): string {
  const { up, down } = relative
  if (down === 0 && up === 1) {
    return pick(gender, 'Schwiegermutter', 'Schwiegervater', 'Schwiegerelternteil')
  }
  if (up === 0 && down === 1) {
    return pick(gender, 'Schwiegertochter', 'Schwiegersohn', 'Schwiegerkind')
  }
  if (up === 1 && down === 1) return pick(gender, 'Schwägerin', 'Schwager', 'Schwager/Schwägerin')
  return `${bloodLabel({ ...relative, half: false }, gender)} (angeheiratet)`
}

function partnerLabel(status: PartnershipStatus, gender?: Gender): string {
  const spouse = pick(gender, 'Ehefrau', 'Ehemann', 'Ehepartner')
  switch (status) {
    case 'married':
      return spouse
    case 'partnered':
      return pick(gender, 'Partnerin', 'Partner', 'Partner')
    case 'separated':
      return `Ex-${pick(gender, 'Partnerin', 'Partner', 'Partner')}`
    case 'divorced':
      return `Ex-${spouse}`
    case 'widowed':
      return pick(gender, 'Verstorbene Ehefrau', 'Verstorbener Ehemann', 'Verstorbener Ehepartner')
  }
}
