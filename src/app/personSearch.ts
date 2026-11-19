import { formatName } from '../model/format'
import type { FamilyGraph, NameParts, Person } from '../model/types'
import { foldMarks } from '../places/speak'

function normalize(text: string): string {
  return foldMarks(text.toLowerCase()).normalize('NFC').trim().replace(/\s+/g, ' ')
}

function indexName(parts: NameParts) {
  const label = formatName(parts)
  return {
    label,
    text: normalize(label),
    parts: [parts.given, ...(parts.surnames ?? []), parts.patronymic ?? ''].map(normalize),
  }
}

export function indexPeople(people: FamilyGraph['people'], language: string) {
  return Object.values(people)
    .filter((person) => !person.isPlaceholder)
    .map((person) => {
      const primary = indexName(person.names[0])
      const alternates = person.names.flatMap((name, index) => [
        ...(index === 0 ? [] : [indexName(name)]),
        ...(name.forms ?? []).map(indexName),
      ])
      return { person, name: primary.label, primary, alternates }
    })
    .sort((a, b) => a.name.localeCompare(b.name, language))
}

type IndexedName = ReturnType<typeof indexName>

function matchRank(name: IndexedName, query: string, words: string[]): number {
  if (name.text === query) return 3
  if (name.parts.includes(query)) return 2
  return words.every((word) => name.text.includes(word)) ? 1 : 0
}

interface PersonMatch {
  person: Person
  name: string
  matchedName?: string
}

export function matchPeople(people: ReturnType<typeof indexPeople>, input: string): PersonMatch[] {
  const query = normalize(input)
  if (!query) return people.map(({ person, name }) => ({ person, name }))

  const words = query.split(' ')
  const matches = people.flatMap(({ person, name, primary, alternates }) => {
    let alternateRank = 0
    let matchedName: string | undefined
    for (const alternate of alternates) {
      if (alternate.label === name) continue
      const rank = matchRank(alternate, query, words)
      if (rank > alternateRank) {
        alternateRank = rank
        matchedName = alternate.label
      }
    }
    const rank = Math.max(matchRank(primary, query, words), alternateRank)
    return rank > 0 ? [{ person, name, matchedName, rank }] : []
  })
  return matches
    .sort((a, b) => b.rank - a.rank)
    .map(({ person, name, matchedName }) => ({ person, name, matchedName }))
}
