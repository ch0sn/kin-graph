import {
  childIdsOf,
  compareNames,
  compareOptionalDates,
  parentIdsOf,
  partnerIdsOf,
  type FamilyGraph,
  type Person,
  type PersonId,
} from '../model'

/** People of one generation, oldest first. */
export interface TimelineGroup {
  /** Relative to the centre person: −1 for parents' generation, +1 for children's. Null for people not connected to them. */
  generation: number | null
  personIds: PersonId[]
}

export interface TimelineRows {
  groups: TimelineGroup[]
  /** People with no birth or death date, who can't be placed on the axis. */
  undated: PersonId[]
}

/**
 * Everyone's generation relative to `rootId`, by the shortest way through the
 * family: a parent is one up, a child one down, a partner on the same level.
 * So aunts sit with parents and in-laws with their partners.
 */
export function generationsFrom(graph: FamilyGraph, rootId: PersonId): Map<PersonId, number> {
  const generations = new Map<PersonId, number>([[rootId, 0]])
  let frontier = [rootId]
  while (frontier.length > 0) {
    const next: PersonId[] = []
    for (const id of frontier) {
      const level = generations.get(id)!
      const steps: [PersonId[], number][] = [
        [parentIdsOf(graph, id), level - 1],
        [childIdsOf(graph, id), level + 1],
        [partnerIdsOf(graph, id), level],
      ]
      for (const [ids, generation] of steps) {
        for (const relativeId of ids) {
          if (generations.has(relativeId)) continue
          generations.set(relativeId, generation)
          next.push(relativeId)
        }
      }
    }
    frontier = next
  }
  return generations
}

export function isDated(person: Person): boolean {
  return Boolean(person.birthDate || person.deathDate)
}

/** The people of a tree in rows for the timeline: grouped by generation, oldest generation first. */
export function timelineRows(graph: FamilyGraph, rootId: PersonId): TimelineRows {
  const generations = generationsFrom(graph, rootId)
  const people = Object.values(graph.people).filter((p) => !p.isPlaceholder)
  const byGeneration = new Map<number | null, Person[]>()
  const undated: Person[] = []
  for (const person of people) {
    if (!isDated(person)) {
      undated.push(person)
      continue
    }
    const generation = generations.get(person.id) ?? null
    byGeneration.set(generation, [...(byGeneration.get(generation) ?? []), person])
  }

  const oldestFirst = (a: Person, b: Person) =>
    compareOptionalDates(a.birthDate, b.birthDate) ||
    compareOptionalDates(a.deathDate, b.deathDate) ||
    compareNames(a, b)
  const groups = [...byGeneration.entries()]
    // Unconnected people come last.
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([generation, members]) => ({ generation, personIds: members.sort(oldestFirst).map((p) => p.id) }))
  return { groups, undated: undated.sort(compareNames).map((p) => p.id) }
}
