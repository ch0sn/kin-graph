import { t } from '../i18n'
import { isDeceased, yearOf, type FamilyGraph, type Person, type PersonId } from '../model'

/** What an export does with people who may still be alive. */
export type LivingPolicy = 'include' | 'anonymise' | 'omit'
export const LIVING_POLICIES: readonly LivingPolicy[] = ['include', 'anonymise', 'omit']

/** Someone born longer ago than this is taken to have died, even without a death date. */
export const LIFESPAN_YEARS = 100
/** The usual gap between a parent's birth and a child's, for guessing unknown birth years. */
const GENERATION_YEARS = 25

/**
 * Who may still be alive: not known to have died, and born within the last
 * `LIFESPAN_YEARS`. Without a birth year, the nearest relative with one gives
 * an estimate; with no estimate at all, a person counts as living, to be safe.
 * Placeholders hold nothing private and never count.
 */
export function livingIds(graph: FamilyGraph, now = new Date()): Set<PersonId> {
  const cutoff = now.getFullYear() - LIFESPAN_YEARS
  const living = new Set<PersonId>()
  for (const person of Object.values(graph.people)) {
    if (person.isPlaceholder || isDeceased(person)) continue
    const born = estimatedBirthYear(graph, person.id)
    if (born === null || born > cutoff) living.add(person.id)
  }
  return living
}

/** A birth year, or one guessed from the closest relative by generations up or down. */
function estimatedBirthYear(graph: FamilyGraph, personId: PersonId): number | null {
  const seen = new Set([personId])
  let frontier: { id: PersonId; offset: number }[] = [{ id: personId, offset: 0 }]
  while (frontier.length) {
    // The first generation out with a known year decides; the earliest of them is the safest guess.
    const known = frontier.flatMap(({ id, offset }) => {
      const date = graph.people[id]?.birthDate
      const year = date ? yearOf(date) : null
      return year === null ? [] : [year + offset]
    })
    if (known.length) return Math.min(...known)
    const next: typeof frontier = []
    for (const { id, offset } of frontier) {
      for (const link of graph.parentLinks) {
        const step =
          link.childId === id
            ? { id: link.parentId, offset: offset + GENERATION_YEARS }
            : link.parentId === id
              ? { id: link.childId, offset: offset - GENERATION_YEARS }
              : null
        if (step && !seen.has(step.id)) {
          seen.add(step.id)
          next.push(step)
        }
      }
    }
    frontier = next
  }
  return null
}

/**
 * The tree to export under `policy`. Anonymised people keep their place and
 * sex but are named "Living", with nothing else about them. Left-out people
 * are removed, except that a parent of someone who stays becomes an unnamed
 * placeholder, so brothers and sisters stay linked through them.
 */
export function applyLivingPolicy(graph: FamilyGraph, policy: LivingPolicy, now = new Date()): FamilyGraph {
  if (policy === 'include') return graph
  const living = livingIds(graph, now)
  if (living.size === 0) return graph
  return policy === 'anonymise' ? anonymise(graph, living) : omit(graph, living)
}

function anonymise(graph: FamilyGraph, living: Set<PersonId>): FamilyGraph {
  const people: Record<PersonId, Person> = {}
  for (const person of Object.values(graph.people)) {
    people[person.id] = living.has(person.id)
      ? { id: person.id, names: [{ given: t('gedcom.living') }], ...(person.gender && { gender: person.gender }) }
      : person
  }
  return {
    ...graph,
    people,
    events: graph.events.filter((e) => !living.has(e.personId)),
    partnerships: graph.partnerships.map((p) =>
      p.partnerIds.some((id) => living.has(id)) ? { id: p.id, partnerIds: p.partnerIds, status: p.status } : p,
    ),
  }
}

function omit(graph: FamilyGraph, living: Set<PersonId>): FamilyGraph {
  const kept = (id: PersonId) => !living.has(id)
  // Only parents of people who stay are needed to hold the tree together.
  const standIns = new Set(
    graph.parentLinks.filter((l) => living.has(l.parentId) && kept(l.childId)).map((l) => l.parentId),
  )
  const people: Record<PersonId, Person> = {}
  for (const person of Object.values(graph.people)) {
    if (kept(person.id)) people[person.id] = person
    else if (standIns.has(person.id)) {
      people[person.id] = { id: person.id, names: [{ given: t('gedcom.unknownName') }], isPlaceholder: true }
    }
  }
  return {
    ...graph,
    people,
    parentLinks: graph.parentLinks.filter((l) => l.childId in people && l.parentId in people),
    partnerships: graph.partnerships.filter((p) => p.partnerIds.every(kept)),
    events: graph.events.filter((e) => kept(e.personId)),
  }
}
