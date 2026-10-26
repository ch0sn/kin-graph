import { parentIdsOf, type FamilyGraph, type ParentKind, type PersonId } from '../model'

/**
 * A person's direct ancestors as numbered slots, the way genealogists number
 * them: the centre person is slot 1, and the parents of slot n are in slots
 * 2n (the father's side) and 2n + 1 (the mother's side). Generation g fills
 * slots 2^g to 2^(g+1) − 1, so `slots` has 2^(generations+1) entries, the
 * first unused. A slot is null when that ancestor isn't known.
 *
 * Unlike `ancestorsOf`, which keeps one shortest path per ancestor, someone
 * who descends from the same ancestor twice (cousins who married) has them
 * in two slots; `repeated` lists who.
 */
export interface Pedigree {
  rootId: PersonId
  generations: number
  slots: (PersonId | null)[]
  repeated: Set<PersonId>
}

/** Biological parents first; adoptive or foster ones only when no biological parent is recorded. */
const PARENT_KINDS: readonly ParentKind[][] = [['biological'], ['adoptive', 'foster']]

/** The ancestors of `rootId`, `generations` back. */
export function pedigree(graph: FamilyGraph, rootId: PersonId, generations: number): Pedigree {
  const slots: (PersonId | null)[] = new Array(2 ** (generations + 1)).fill(null)
  slots[1] = rootId
  for (let index = 1; index < 2 ** generations; index++) {
    const personId = slots[index]
    if (!personId) continue
    const [father, mother] = parentPair(graph, personId)
    slots[2 * index] = father
    slots[2 * index + 1] = mother
  }

  const seen = new Set<PersonId>()
  const repeated = new Set<PersonId>()
  for (const id of slots) {
    if (!id) continue
    if (seen.has(id)) repeated.add(id)
    seen.add(id)
  }
  return { rootId, generations, slots, repeated }
}

/**
 * A person's two parents, father's side first. Placeholder parents (stand-ins
 * linking siblings) count as unknown. When gender doesn't tell the sides
 * apart, the order the parents were recorded in does.
 */
export function parentPair(graph: FamilyGraph, personId: PersonId): [PersonId | null, PersonId | null] {
  const real = (ids: PersonId[]) => ids.filter((id) => graph.people[id] && !graph.people[id].isPlaceholder)
  const parents =
    PARENT_KINDS.map((kinds) => real(parentIdsOf(graph, personId, kinds))).find((ids) => ids.length > 0) ?? []
  const gender = (id: PersonId) => graph.people[id].gender
  const [a, b] = parents
  if (!a) return [null, null]
  if (!b) return gender(a) === 'female' ? [null, a] : [a, null]
  if (gender(a) === 'female' && gender(b) !== 'female') return [b, a]
  if (gender(b) === 'male' && gender(a) !== 'male') return [b, a]
  return [a, b]
}

/** The generation a slot belongs to: 0 for the centre, 1 for parents, … */
export function generationOf(index: number): number {
  return Math.floor(Math.log2(index))
}

/** How many ancestor slots are filled, and how many there are, leaving out the centre person. */
export function ancestorCounts({ slots }: Pedigree): { known: number; total: number } {
  const ancestors = slots.slice(2)
  return { known: ancestors.filter(Boolean).length, total: ancestors.length }
}
