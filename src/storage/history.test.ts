import { describe, expect, it } from 'vitest'
import { emptyHistory, record, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes edits in order', () => {
    let history = record(record(emptyHistory<string>(), 'a'), 'b')
    const back = undo(history, 'c')!
    expect(back.value).toBe('b')
    history = back.history
    const further = undo(history, 'b')!
    expect(further.value).toBe('a')
    expect(undo(further.history, 'a')).toBeNull()
    const forward = redo(further.history, 'a')!
    expect(forward.value).toBe('b')
    expect(redo(forward.history, 'b')!.value).toBe('c')
  })

  it('forgets what was undone once a new edit is made', () => {
    const undone = undo(record(emptyHistory<string>(), 'a'), 'b')!
    const edited = record(undone.history, 'a')
    expect(redo(edited, 'x')).toBeNull()
    expect(edited.past).toEqual(['a'])
  })

  it('keeps only the latest steps', () => {
    let history = emptyHistory<number>()
    for (let i = 0; i < 5; i++) history = record(history, i, 3)
    expect(history.past).toEqual([2, 3, 4])
  })
})
