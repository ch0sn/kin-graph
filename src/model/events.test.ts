import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { en } from '../i18n/en'
import {
  addEvent,
  EVENT_KINDS,
  EVENT_TYPES,
  eventsOf,
  eventTitle,
  isKindOf,
  removeEvent,
  setEvents,
  sortEvents,
  timelineOf,
  typeOfKind,
  updateEvent,
  EventError,
} from './events'
import { addPartner, createGraph, removePerson, addChild, updatePartnership } from './graph'
import { simpleName } from './format'

describe('events', () => {
  const start = () => createGraph({ names: [simpleName('Pat')], birthDate: '1900', deathDate: '1980' })

  it('adds, updates and removes events', () => {
    let graph = start()
    const id = graph.managerId
    graph = addEvent(graph, id, { type: 'work', description: 'Baker' })
    const [event] = eventsOf(graph, id)
    expect(event).toMatchObject({ personId: id, type: 'work', description: 'Baker' })

    graph = updateEvent(graph, event.id, { date: '~1925' })
    expect(eventsOf(graph, id)[0]).toMatchObject({ description: 'Baker', date: '~1925' })
    expect(() => updateEvent(graph, 'nope', {})).toThrow(EventError)

    graph = removeEvent(graph, event.id)
    expect(graph.events).toEqual([])
  })

  it('refuses events for people who are not in the tree', () => {
    expect(() => addEvent(start(), 'ghost', { type: 'other', label: 'x' })).toThrow()
  })

  it('replaces one person’s events and leaves others', () => {
    let graph = start()
    const added = addChild(graph, graph.managerId, { names: [simpleName('Kid')] })
    graph = addEvent(added.graph, added.person.id, { type: 'education', date: '1950' })
    graph = addEvent(graph, graph.managerId, { type: 'residence', place: 'Oslo' })
    const [mine] = eventsOf(graph, graph.managerId)
    graph = setEvents(graph, graph.managerId, [{ id: mine.id, type: 'residence', place: 'Rome' }, { type: 'funeral', kind: 'burial', place: 'Rome' }])
    expect(eventsOf(graph, graph.managerId).map((e) => e.place)).toEqual(['Rome', 'Rome'])
    expect(eventsOf(graph, graph.managerId)[0].id).toBe(mine.id)
    expect(eventsOf(graph, added.person.id)).toHaveLength(1)
  })

  it('removes a person’s events with them', () => {
    const graph = start()
    const added = addPartner(graph, graph.managerId, { names: [simpleName('Sam')] })
    const withEvent = addEvent(added.graph, added.person.id, { type: 'military', date: '1941/1945' })
    expect(removePerson(withEvent, added.person.id).events).toEqual([])
  })

  it('sorts by date with undated events last, keeping the order they were added in', () => {
    const events = [
      { id: 'a' },
      { id: 'b', date: '1950' },
      { id: 'c' },
      { id: 'd', date: '~1950' },
      { id: 'e', date: '<1950' },
    ]
    expect(sortEvents(events).map((e) => e.id)).toEqual(['e', 'd', 'b', 'a', 'c'])
  })
})

describe('timelineOf', () => {
  it('mixes birth, death, marriages and events in date order', () => {
    let graph = createGraph({ names: [simpleName('Pat')], birthDate: '1900-05-01', deathDate: '1980' })
    const added = addPartner(graph, graph.managerId, { names: [simpleName('Sam')] }, 'divorced')
    graph = updatePartnership(added.graph, added.graph.partnerships[0].id, {
      startDate: '1925',
      endDate: '1935',
    })
    graph = addEvent(graph, graph.managerId, { type: 'migration', date: '~1923', place: 'Chicago' })
    graph = addEvent(graph, graph.managerId, { type: 'military', date: '1941/1945' })
    graph = addEvent(graph, graph.managerId, { type: 'other', label: 'Won a prize' })

    const timeline = timelineOf(graph, graph.managerId)
    expect(timeline.map((e) => [e.type, e.date])).toEqual([
      ['birth', '1900-05-01'],
      ['migration', '~1923'],
      ['marriage', '1925'],
      ['divorce', '1935'],
      ['military', '1941/1945'],
      ['death', '1980'],
      ['other', undefined],
    ])
    expect(timeline.find((e) => e.type === 'marriage')?.partnerId).toBe(added.person.id)
    expect(timeline.filter((e) => e.event).map((e) => e.type)).toEqual(['migration', 'military', 'other'])
  })

  it('leaves an unmarried partnership off', () => {
    const graph = createGraph({ names: [simpleName('Pat')] })
    const added = addPartner(graph, graph.managerId, { names: [simpleName('Sam')] }, 'partnered')
    const next = updatePartnership(added.graph, added.graph.partnerships[0].id, { startDate: '1990' })
    expect(timelineOf(next, next.managerId)).toEqual([])
  })

  it('works on the sample family', () => {
    const graph = sampleFamily()
    expect(() => timelineOf(graph, graph.managerId)).not.toThrow()
  })
})

describe('event kinds', () => {
  it('belong to exactly one type, and every type and kind has a name', () => {
    const all = Object.values(EVENT_KINDS).flat()
    expect(new Set(all).size).toBe(all.length)
    for (const type of EVENT_TYPES) {
      expect(en).toHaveProperty(`event.${type}`)
      for (const kind of EVENT_KINDS[type]) {
        expect(typeOfKind(kind)).toBe(type)
        expect(en).toHaveProperty(`eventKind.${kind}`)
      }
    }
    expect(EVENT_KINDS.other).toEqual([])
  })

  it('checks a kind against its type', () => {
    expect(isKindOf('religion', 'childBaptism')).toBe(true)
    expect(isKindOf('religion', 'firstJob')).toBe(false)
    expect(isKindOf('education', undefined)).toBe(false)
  })

  it('names an event by its own name, then its kind, then its type', () => {
    expect(eventTitle({ type: 'religion', kind: 'childBaptism', label: 'Christening at St Mary' })).toBe(
      'Christening at St Mary',
    )
    expect(eventTitle({ type: 'religion', kind: 'childBaptism' })).toBe('Child baptism')
    expect(eventTitle({ type: 'education' })).toBe('Education')
    expect(eventTitle({ type: 'birth' })).toBe('Born')
  })
})
