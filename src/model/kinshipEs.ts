import { getPerson, partnershipBetween } from './queries'
import type { BloodKinship, Kinship } from './kinship'
import type { FamilyGraph, Gender, PartnershipStatus, PersonId } from './types'

/**
 * Spanish relationship labels. Spanish words agree with the relative's
 * gender throughout (tía abuela, primo segundo, cuñada), and relatives by
 * marriage are "político/política".
 */
export function describeKinshipEs(
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
        return fromId === graph.managerId ? 'Tú' : 'Misma persona'
      case 'blood':
        return bloodLabel(k, gender)
      case 'partner':
        return partnerLabel(k.status, gender)
      case 'step-parent':
        return pick(gender, 'madrastra', 'padrastro', 'padrastro/madrastra')
      case 'step-child':
        return pick(gender, 'hijastra', 'hijastro', 'hijastro/a')
      case 'step-sibling':
        return pick(gender, 'hermanastra', 'hermanastro', 'hermanastro/a')
      case 'relatives-partner': {
        const { up, down } = k.relative
        if (up === 0 || (up === 1 && down === 1) || down <= 1) return inLaw(k.relative, gender)
        const relative = getPerson(graph, k.relativeId)
        const status = partnershipBetween(graph, k.relativeId, toId)?.status ?? 'partnered'
        return `${partnerLabel(status, gender)} de ${bloodLabel(k.relative, relative.gender)}`
      }
      case 'partners-relative': {
        const { up, down } = k.relative
        if (down === 0 || up === 0 || (up === 1 && down === 1)) return inLaw(k.relative, gender)
        const partner = getPerson(graph, k.partnerId)
        const status = partnershipBetween(graph, fromId, k.partnerId)?.status ?? 'partnered'
        return `${bloodLabel(k.relative, gender)} de ${partnerLabel(status, partner.gender)}`
      }
    }
  }
}

function pick(gender: Gender | undefined, female: string, male: string, neutral: string) {
  return gender === 'female' ? female : gender === 'male' ? male : neutral
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Abuela, bisabuela, tatarabuela, trastatarabuela, … (and the same for nietos). */
function generations(count: number, word: string): string {
  if (count <= 1) return word
  if (count === 2) return `bis${word}`
  return `${'tras'.repeat(count - 3)}tatara${word}`
}

const ORDINALS = ['', '', 'segund', 'tercer', 'cuart', 'quint', 'sext', 'séptim', 'octav', 'noven', 'décim']

function bloodLabel({ up, down, half }: BloodKinship, gender?: Gender): string {
  if (up === 0 && down === 0) return 'misma persona'
  if (down === 0) {
    if (up === 1) return pick(gender, 'madre', 'padre', 'progenitor')
    return generations(up - 1, pick(gender, 'abuela', 'abuelo', 'abuelo/a'))
  }
  if (up === 0) {
    if (down === 1) return pick(gender, 'hija', 'hijo', 'hijo/a')
    return generations(down - 1, pick(gender, 'nieta', 'nieto', 'nieto/a'))
  }
  if (up === 1 && down === 1) {
    const sibling = pick(gender, 'hermana', 'hermano', 'hermano/a')
    return half ? `${pick(gender, 'media', 'medio', 'medio/a')} ${sibling}` : sibling
  }
  if (down === 1) {
    const base = pick(gender, 'tía', 'tío', 'tío/a')
    if (up === 2) return base
    return `${base} ${generations(up - 2, pick(gender, 'abuela', 'abuelo', 'abuelo/a'))}`
  }
  if (up === 1) {
    const base = pick(gender, 'sobrina', 'sobrino', 'sobrino/a')
    if (down === 2) return base
    return `${base} ${generations(down - 2, pick(gender, 'nieta', 'nieto', 'nieto/a'))}`
  }

  const degree = Math.min(up, down) - 1
  const removed = Math.abs(up - down)
  const cousin = pick(gender, 'prima', 'primo', 'primo/a')
  const ordinal = ORDINALS[degree]
  const parts = [
    degree === 1
      ? cousin
      : ordinal
        ? `${cousin} ${ordinal}${pick(gender, 'a', 'o', 'o/a')}`
        : `${cousin} de ${degree}.º grado`,
  ]
  if (removed > 0) {
    parts.push(`(${removed} ${removed === 1 ? 'generación' : 'generaciones'} de diferencia)`)
  }
  return parts.join(' ')
}

/** Suegra, yerno, cuñado, or "… político/a" for other relatives by marriage. */
function inLaw(relative: BloodKinship, gender?: Gender): string {
  const { up, down } = relative
  if (down === 0 && up === 1) return pick(gender, 'suegra', 'suegro', 'suegro/a')
  if (up === 0 && down === 1) return pick(gender, 'nuera', 'yerno', 'yerno/nuera')
  if (up === 1 && down === 1) return pick(gender, 'cuñada', 'cuñado', 'cuñado/a')
  const label = bloodLabel({ ...relative, half: false }, gender)
  return `${label} ${pick(gender, 'política', 'político', 'político/a')}`
}

function partnerLabel(status: PartnershipStatus, gender?: Gender): string {
  const spouse = pick(gender, 'esposa', 'esposo', 'cónyuge')
  switch (status) {
    case 'married':
      return spouse
    case 'partnered':
      return 'pareja'
    case 'separated':
      return 'expareja'
    case 'divorced':
      return `ex${spouse}`
    case 'widowed':
      return `${pick(gender, 'difunta', 'difunto', 'difunto/a')} ${spouse}`
  }
}
