import type { FamilyGraph } from '../model'

/**
 * Copies of a tree kept on the device, so a mistake found later, after undo
 * is gone, can still be put right. They're taken automatically:
 *
 *   opened         when KinGraph starts, of each tree as it was saved
 *   autosave       every `SNAPSHOT_INTERVAL_MS` while a tree is being edited
 *   beforeRemove   just before someone is removed
 *   beforeRestore  just before an older snapshot replaces the tree
 */
export type SnapshotReason = 'opened' | 'autosave' | 'beforeRemove' | 'beforeRestore'
export const SNAPSHOT_REASONS: readonly SnapshotReason[] = ['opened', 'autosave', 'beforeRemove', 'beforeRestore']

export interface Snapshot {
  id: string
  /** When it was taken, in ms. */
  takenAt: number
  reason: SnapshotReason
  graph: FamilyGraph
}

/** How often a tree being edited is copied. */
export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000
/** Every one of the latest snapshots is kept… */
export const KEEP_RECENT = 15
/** …then one a day, up to this many in all. */
export const MAX_SNAPSHOTS = 40

/**
 * Which snapshots to keep, newest first: all of the latest `KEEP_RECENT`,
 * then the newest of each day before them, `MAX_SNAPSHOTS` at most.
 */
export function retain<T extends { takenAt: number }>(snapshots: readonly T[]): T[] {
  const newestFirst = [...snapshots].sort((a, b) => b.takenAt - a.takenAt)
  const kept = newestFirst.slice(0, KEEP_RECENT)
  const days = new Set<string>()
  for (const snapshot of newestFirst.slice(KEEP_RECENT)) {
    const day = dayOf(snapshot.takenAt)
    if (days.has(day)) continue
    days.add(day)
    kept.push(snapshot)
  }
  return kept.slice(0, MAX_SNAPSHOTS)
}

function dayOf(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export interface PeopleDiff {
  /** In `to` but not `from`. */
  added: number
  /** In `from` but not `to`. */
  removed: number
  /** In both, with different details. */
  changed: number
}

/** How the people differ between two versions of a tree; placeholder parents don't count. */
export function diffPeople(from: FamilyGraph, to: FamilyGraph): PeopleDiff {
  const diff = { added: 0, removed: 0, changed: 0 }
  for (const [id, person] of Object.entries(to.people)) {
    if (person.isPlaceholder) continue
    const before = from.people[id]
    if (!before || before.isPlaceholder) diff.added++
    else if (JSON.stringify(before) !== JSON.stringify(person)) diff.changed++
  }
  for (const [id, person] of Object.entries(from.people)) {
    if (!person.isPlaceholder && (!to.people[id] || to.people[id].isPlaceholder)) diff.removed++
  }
  return diff
}
