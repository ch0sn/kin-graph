import { describe, expect, it } from 'vitest'
import {
  CUSTOM_KIND,
  emptyEventValues,
  needsLabel,
  toEventFields,
  validateEvent,
  valuesFromEvent,
  withType,
} from './eventValues'

describe('validateEvent', () => {
  it('needs something to record besides the type', () => {
    expect(validateEvent(emptyEventValues())).toHaveProperty('content')
    expect(validateEvent(emptyEventValues({ place: 'Oslo' }))).toEqual({})
    expect(validateEvent(emptyEventValues({ description: ' Baker ' }))).toEqual({})
    expect(validateEvent(emptyEventValues({ date: '~1900' }))).toEqual({})
  })

  it('needs an own name for "Other" and for "Something else…"', () => {
    const other = emptyEventValues({ type: 'other', date: '1900' })
    expect(validateEvent(other)).toHaveProperty('label')
    expect(validateEvent({ ...other, label: 'Won a prize' })).toEqual({})

    const custom = emptyEventValues({ type: 'education', kind: CUSTOM_KIND, date: '1900' })
    expect(validateEvent(custom)).toHaveProperty('label')
    expect(validateEvent({ ...custom, label: 'Driving licence' })).toEqual({})

    expect(validateEvent(emptyEventValues({ kind: 'firstDayOfSchool', date: '2004' }))).toEqual({})
  })

  it('checks the date', () => {
    expect(validateEvent(emptyEventValues({ date: '1920/1910' }))).toHaveProperty('date')
    expect(validateEvent(emptyEventValues({ date: '19' }))).toHaveProperty('date')
    expect(validateEvent(emptyEventValues({ date: '1910/1920' }))).toEqual({})
  })
})

describe('withType', () => {
  it('goes back to the type in general, since kinds belong to one type', () => {
    const values = emptyEventValues({ type: 'religion', kind: 'childBaptism' })
    expect(withType(values, 'education')).toMatchObject({ type: 'education', kind: '' })
  })

  it('keeps an own name being typed', () => {
    const values = emptyEventValues({ type: 'religion', kind: CUSTOM_KIND, label: 'Blessing' })
    expect(withType(values, 'education')).toMatchObject({ kind: CUSTOM_KIND, label: 'Blessing' })
    expect(needsLabel(withType(values, 'other'))).toBe(true)
  })
})

describe('toEventFields', () => {
  it('keeps a listed kind and drops an own name it no longer uses', () => {
    expect(
      toEventFields(emptyEventValues({ type: 'religion', kind: 'childBaptism', label: 'old', place: ' Oslo ' })),
    ).toEqual({
      type: 'religion',
      kind: 'childBaptism',
      label: undefined,
      date: undefined,
      place: 'Oslo',
      description: undefined,
    })
  })

  it('stores an own name instead of a kind for "Something else…" and "Other"', () => {
    expect(
      toEventFields(emptyEventValues({ type: 'education', kind: CUSTOM_KIND, label: ' Driving licence ', date: '2015' })),
    ).toMatchObject({ type: 'education', kind: undefined, label: 'Driving licence' })
    expect(toEventFields(emptyEventValues({ type: 'other', label: ' Prize ', date: '1900' }))).toMatchObject({
      type: 'other',
      kind: undefined,
      label: 'Prize',
    })
  })

  it('drops a kind that belongs to another type', () => {
    expect(toEventFields(emptyEventValues({ type: 'work', kind: 'childBaptism', date: '1990' })).kind).toBeUndefined()
  })

  it('round-trips events through the form', () => {
    const events = [
      { id: '1', personId: 'p', type: 'military' as const, kind: 'deployed' as const, date: '1941/1945', place: 'Navy' },
      { id: '2', personId: 'p', type: 'education' as const, label: 'Driving licence', date: '2015' },
      { id: '3', personId: 'p', type: 'work' as const, description: 'Baker' },
      { id: '4', personId: 'p', type: 'other' as const, label: 'Won a prize', date: '1966' },
    ]
    for (const { id: _id, personId: _personId, ...fields } of events) {
      const event = { id: 'x', personId: 'p', ...fields }
      expect(toEventFields(valuesFromEvent(event))).toEqual({
        kind: undefined,
        label: undefined,
        date: undefined,
        place: undefined,
        description: undefined,
        ...fields,
      })
    }
    expect(valuesFromEvent({ ...events[1] }).kind).toBe(CUSTOM_KIND)
    expect(valuesFromEvent({ ...events[0] }).kind).toBe('deployed')
  })
})
