import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver, type SaveState } from './autosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(save = vi.fn(async (_value: number) => {})) {
  const states: SaveState[] = []
  const autosaver = createAutosaver(save, { delay: 400, onStateChange: (s) => states.push(s) })
  return { autosaver, save, states }
}

describe('createAutosaver', () => {
  it('saves only the latest value once edits pause', async () => {
    const { autosaver, save, states } = setup()
    autosaver.schedule(1)
    await vi.advanceTimersByTimeAsync(300)
    autosaver.schedule(2)
    await vi.advanceTimersByTimeAsync(300)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledExactlyOnceWith(2)
    expect(states.at(-1)).toBe('saved')
  })

  it('saves immediately on flush', async () => {
    const { autosaver, save } = setup()
    autosaver.schedule(1)
    await autosaver.flush()
    expect(save).toHaveBeenCalledExactlyOnceWith(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('runs saves in order, one at a time', async () => {
    const order: string[] = []
    const save = vi.fn(async (value: number) => {
      order.push(`start ${value}`)
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 500 : 10))
      order.push(`end ${value}`)
    })
    const { autosaver } = setup(save)
    autosaver.schedule(1)
    void autosaver.flush()
    autosaver.schedule(2)
    const done = autosaver.flush()
    await vi.advanceTimersByTimeAsync(1000)
    await done
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2'])
  })

  it('reports failures and recovers on the next save', async () => {
    const save = vi.fn(async (_value: number) => {}).mockRejectedValueOnce(new Error('quota'))
    const { autosaver, states } = setup(save)
    autosaver.schedule(1)
    await autosaver.flush()
    expect(states.at(-1)).toBe('failed')

    autosaver.schedule(2)
    await autosaver.flush()
    expect(states.at(-1)).toBe('saved')
  })

  it('drops a waiting value on cancel', async () => {
    const { autosaver, save } = setup()
    autosaver.schedule(1)
    expect(autosaver.hasPending()).toBe(true)
    autosaver.cancel()
    expect(autosaver.hasPending()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
  })
})
