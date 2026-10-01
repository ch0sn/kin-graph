import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { addSibling, createGraph, type FamilyGraph } from '../model'
import {
  parseTreeDocument,
  toDocument,
  TREE_FORMAT,
  TREE_VERSION,
  TreeFileError,
} from './treeDocument'

/** A document as it would come back from JSON, so tests can damage it. */
function json(graph: FamilyGraph = sampleFamily()) {
  return JSON.parse(JSON.stringify(toDocument(graph)))
}

describe('toDocument / parseTreeDocument', () => {
  it('round-trips the sample family through JSON', () => {
    const graph = sampleFamily()
    expect(parseTreeDocument(json(graph))).toEqual(graph)
  })

  it('keeps placeholder parents', () => {
    const alex = createGraph({ givenName: 'Alex' })
    const { graph } = addSibling(alex, alex.managerId, { givenName: 'Sara' })
    const parsed = parseTreeDocument(json(graph))
    expect(parsed).toEqual(graph)
    expect(Object.values(parsed.people).some((p) => p.isPlaceholder)).toBe(true)
  })

  it('records the format, version and save time', () => {
    const doc = toDocument(sampleFamily(), new Date('2026-10-01T12:00:00Z'))
    expect(doc).toMatchObject({
      format: TREE_FORMAT,
      version: TREE_VERSION,
      savedAt: '2026-10-01T12:00:00.000Z',
    })
  })

  it('drops unknown fields', () => {
    const doc = json()
    const [id] = Object.keys(doc.graph.people)
    doc.graph.people[id].nickname = 'Al'
    expect(parseTreeDocument(doc).people[id]).not.toHaveProperty('nickname')
  })
})

describe('parseTreeDocument rejects', () => {
  const rejects = (doc: unknown, message: RegExp) => {
    expect(() => parseTreeDocument(doc)).toThrow(TreeFileError)
    expect(() => parseTreeDocument(doc)).toThrow(message)
  }

  it('things that are not KinGraph files', () => {
    rejects(null, /isn’t a KinGraph/)
    rejects([], /isn’t a KinGraph/)
    rejects({ format: 'gedcom' }, /isn’t a KinGraph/)
  })

  it('unknown and newer versions', () => {
    rejects({ ...json(), version: 0 }, /unrecognised version/)
    rejects({ ...json(), version: '1' }, /unrecognised version/)
    rejects({ ...json(), version: TREE_VERSION + 1 }, /newer version/)
  })

  it('a missing or unknown manager', () => {
    const doc = json()
    doc.graph.managerId = 'nobody'
    rejects(doc, /whose tree/)
  })

  it('people without an id or name', () => {
    const doc = json()
    const [id] = Object.keys(doc.graph.people)
    delete doc.graph.people[id].givenName
    rejects(doc, /missing their id or name/)
  })

  it('invalid person fields', () => {
    const withPerson = (patch: object) => {
      const doc = json()
      const [id] = Object.keys(doc.graph.people)
      Object.assign(doc.graph.people[id], patch)
      return doc
    }
    rejects(withPerson({ gender: 'robot' }), /unknown gender/)
    rejects(withPerson({ birthDate: '12/03/1950' }), /date isn’t valid/)
    rejects(withPerson({ familyName: 42 }), /isn’t text/)
  })

  it('links to people who are not in the tree', () => {
    const doc = json()
    doc.graph.parentLinks[0].parentId = 'ghost'
    rejects(doc, /isn’t in the tree/)

    const doc2 = json()
    doc2.graph.partnerships[0].partnerIds[1] = 'ghost'
    rejects(doc2, /isn’t in the tree/)
  })

  it('invalid kinds and statuses', () => {
    const doc = json()
    doc.graph.parentLinks[0].kind = 'step'
    rejects(doc, /unknown kind/)

    const doc2 = json()
    doc2.graph.partnerships[0].status = 'engaged'
    rejects(doc2, /unknown status/)
  })

  it('duplicates, too many parents and ancestry loops', () => {
    const duplicateLink = json()
    duplicateLink.graph.parentLinks.push({ ...duplicateLink.graph.parentLinks[0] })
    rejects(duplicateLink, /appears twice/)

    const duplicatePartnership = json()
    const [first] = duplicatePartnership.graph.partnerships
    duplicatePartnership.graph.partnerships.push({ ...first, id: 'other' })
    rejects(duplicatePartnership, /appears twice/)

    const threeParents = json()
    const { managerId, people } = threeParents.graph
    const stranger = Object.keys(people).find(
      (id) =>
        id !== managerId &&
        !threeParents.graph.parentLinks.some(
          (l: { parentId: string; childId: string }) =>
            l.childId === managerId && l.parentId === id,
        ) &&
        !threeParents.graph.parentLinks.some(
          (l: { parentId: string; childId: string }) =>
            l.parentId === managerId && l.childId === id,
        ),
    )
    threeParents.graph.parentLinks.push({ parentId: stranger, childId: managerId, kind: 'biological' })
    rejects(threeParents, /more than two biological parents/)

    const loop = json()
    const link = loop.graph.parentLinks[0]
    loop.graph.parentLinks.push({ parentId: link.childId, childId: link.parentId, kind: 'adoptive' })
    rejects(loop, /own ancestor/)
  })

  it('missing lists', () => {
    const doc = json()
    delete doc.graph.partnerships
    rejects(doc, /partnerships are missing/)
  })
})
