/**
 * Undo and redo for one tree. Edits replace the whole (immutable) graph, so
 * each step is simply the graph as it was; unchanged parts are shared, which
 * keeps even a long history small.
 */
export interface History<T> {
  /** Earlier states, oldest first. */
  past: T[]
  /** States undone, the next to redo last. */
  future: T[]
}

/** How many steps can be undone. */
export const HISTORY_LIMIT = 100

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] }
}

/** Records that an edit replaced `previous`; anything undone can no longer be redone. */
export function record<T>(history: History<T>, previous: T, limit = HISTORY_LIMIT): History<T> {
  return { past: [...history.past, previous].slice(-limit), future: [] }
}

/** Steps back from `current`, or null when there's nothing to undo. */
export function undo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.past.length === 0) return null
  const value = history.past[history.past.length - 1]
  return { value, history: { past: history.past.slice(0, -1), future: [...history.future, current] } }
}

/** Steps forward from `current` again, or null when nothing was undone. */
export function redo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.future.length === 0) return null
  const value = history.future[history.future.length - 1]
  return { value, history: { past: [...history.past, current], future: history.future.slice(0, -1) } }
}
