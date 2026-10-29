import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { addPerson, removePerson, updatePerson } from '../model'
import { diffPeople, KEEP_RECENT, MAX_SNAPSHOTS, retain } from './snapshots'

const DAY = 24 * 60 * 60 * 1000

describe('retain', () => {
  it('keeps every recent snapshot, newest first', () => {
    const snapshots = [{ takenAt: 1 }, { takenAt: 3 }, { takenAt: 2 }]
    expect(retain(snapshots)).toEqual([{ takenAt: 3 }, { takenAt: 2 }, { takenAt: 1 }])
  })

  it('keeps one a day of the older ones, and never more than the limit', () => {
    const start = new Date(2026, 0, 1, 12).getTime()
    // Ten a day for a hundred days.
    const snapshots = Array.from({ length: 1000 }, (_, i) => ({ takenAt: start + Math.floor(i / 10) * DAY + (i % 10) }))
    const kept = retain(snapshots)
    expect(kept).toHaveLength(MAX_SNAPSHOTS)
    expect(kept.slice(0, KEEP_RECENT)).toEqual(
      [...snapshots].sort((a, b) => b.takenAt - a.takenAt).slice(0, KEEP_RECENT),
    )
    const olderDays = kept.slice(KEEP_RECENT).map((s) => new Date(s.takenAt).toDateString())
    expect(new Set(olderDays).size).toBe(olderDays.length)
  })
})

describe('diffPeople', () => {
  it('counts people added, removed and changed', () => {
    const before = sampleFamily()
    const [first, second] = Object.keys(before.people).filter((id) => id !== before.managerId)
    let after = removePerson(before, first)
    after = updatePerson(after, second, { notes: 'Changed' })
    after = addPerson(after, { names: [{ given: 'New' }] }).graph
    after = addPerson(after, { names: [{ given: 'Newer' }] }).graph
    expect(diffPeople(before, after)).toEqual({ added: 2, removed: 1, changed: 1 })
    expect(diffPeople(before, before)).toEqual({ added: 0, removed: 0, changed: 0 })
  })
})
