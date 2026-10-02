export type SaveState = 'saved' | 'saving' | 'failed'

export interface Autosaver<T> {
  /** Saves `value` once changes have paused, replacing any value still waiting. */
  schedule: (value: T) => void
  /** Saves any waiting value now. Resolves once all saves have finished. */
  flush: () => Promise<void>
  /** Drops a waiting value without saving it. */
  cancel: () => void
  hasPending: () => boolean
}

/**
 * Debounces saves so a burst of edits is written once, and runs saves one at
 * a time so a slow write can't land after a newer one.
 */
export function createAutosaver<T>(
  save: (value: T) => Promise<void>,
  {
    delay = 400,
    onStateChange = () => {},
  }: { delay?: number; onStateChange?: (state: SaveState) => void } = {},
): Autosaver<T> {
  let pending: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let queue = Promise.resolve()

  const run = () => {
    clearTimeout(timer)
    timer = undefined
    if (!pending) return queue
    const { value } = pending
    pending = null
    queue = queue
      .then(() => save(value))
      .then(
        () => {
          if (!pending) onStateChange('saved')
        },
        () => onStateChange('failed'),
      )
    return queue
  }

  return {
    schedule(value) {
      pending = { value }
      onStateChange('saving')
      clearTimeout(timer)
      timer = setTimeout(run, delay)
    },
    flush: run,
    cancel() {
      clearTimeout(timer)
      timer = undefined
      pending = null
    },
    hasPending: () => pending !== null,
  }
}
