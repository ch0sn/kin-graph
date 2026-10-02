import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { addSibling, createGraph, type FamilyGraph } from '../model'
import {
  parseBackup,
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

/** The same tree as a version 1 or 2 file stored it, with one given and one family name. */
function legacy(graph: FamilyGraph, version: 1 | 2) {
  const doc = json(graph)
  for (const person of Object.values<Record<string, unknown>>(doc.graph.people)) {
    const [{ given, surnames }] = person.names as { given: string; surnames?: string[] }[]
    delete person.names
    person.givenName = given
    if (surnames) person.familyName = surnames[0]
  }
  return { ...doc, version }
}

describe('toDocument / parseTreeDocument', () => {
  it('round-trips the sample family through JSON', () => {
    const graph = sampleFamily()
    expect(parseTreeDocument(json(graph))).toEqual(graph)
  })

  it('keeps placeholder parents', () => {
    const alex = createGraph({ names: [{ given: 'Alex' }] })
    const { graph } = addSibling(alex, alex.managerId, { names: [{ given: 'Sara' }] })
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

  it('opens version 1 files, from before photos and the deceased flag', () => {
    const graph = sampleFamily()
    expect(parseTreeDocument(legacy(graph, 1))).toEqual(graph)
  })

  it('opens version 2 files, turning their given and family name into a name', () => {
    const graph = sampleFamily()
    const parsed = parseTreeDocument(legacy(graph, 2))
    expect(parsed).toEqual(graph)
    expect(parsed.people[graph.managerId].names).toEqual([{ given: 'Alex', surnames: ['Morgan'] }])
  })

  it('keeps several names, with their types, dates and other scripts', () => {
    const graph = createGraph({
      names: [
        {
          given: '민준',
          surnames: ['김'],
          forms: [
            { script: 'hanja', given: '敏俊', surnames: ['金'] },
            { script: 'romanized', given: 'Minjun', surnames: ['Kim'] },
          ],
        },
        { type: 'nickname', given: 'MJ' },
        { type: 'married', given: 'Ana', surnames: ['García', 'López'], from: '2010-06' },
        { type: 'birth', given: 'Björk', patronymic: 'Guðmundsdóttir' },
      ],
    })
    expect(parseTreeDocument(json(graph))).toEqual(graph)
  })

  it('keeps the deceased flag and photo references', () => {
    const graph = sampleFamily()
    const id = graph.managerId
    graph.people[id] = { ...graph.people[id], deceased: true, photoId: 'face-1' }
    expect(parseTreeDocument(json(graph)).people[id]).toMatchObject({
      deceased: true,
      photoId: 'face-1',
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
    delete doc.graph.people[id].names
    rejects(doc, /missing their id or name/)

    const noNames = json()
    noNames.graph.people[noNames.graph.managerId].names = []
    rejects(noNames, /missing their id or name/)

    const blank = json()
    blank.graph.people[blank.graph.managerId].names[0].given = ' '
    rejects(blank, /missing their id or name/)
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
  })

  it('malformed names', () => {
    const withName = (name: object) => {
      const doc = json()
      doc.graph.people[doc.graph.managerId].names.push(name)
      return doc
    }
    rejects(withName({ surnames: ['Smith'] }), /name is malformed/)
    rejects(withName({ given: 'Ann', surnames: 'Smith' }), /name is malformed/)
    rejects(withName({ given: 'Ann', surnames: [42] }), /name is malformed/)
    rejects(withName({ given: 'Ann', type: 'title' }), /name is malformed/)
    rejects(withName({ given: 'Ann', forms: [{ script: 'klingon', given: 'x' }] }), /name is malformed/)
    rejects(withName({ given: 'Ann', from: 'last year' }), /date isn’t valid/)
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

  it('invalid flags and photo references', () => {
    const withPerson = (patch: object) => {
      const doc = json()
      Object.assign(doc.graph.people[doc.graph.managerId], patch)
      return doc
    }
    rejects(withPerson({ deceased: 'yes' }), /invalid deceased flag/)
    rejects(withPerson({ photoId: 7 }), /photo reference is invalid/)
  })

  it('photos that are not small images', () => {
    const withPhotos = (photos: unknown) => ({ ...json(), photos })
    expect(() => parseBackup(withPhotos([]))).toThrow(/photos are malformed/)
    expect(() => parseBackup(withPhotos({ a: 'data:text/html;base64,PGI+' }))).toThrow(
      /supported image/,
    )
    expect(() => parseBackup(withPhotos({ a: 'https://example.com/face.jpg' }))).toThrow(
      /supported image/,
    )
    const huge = 'A'.repeat(3 * 1024 * 1024)
    expect(() => parseBackup(withPhotos({ a: `data:image/jpeg;base64,${huge}` }))).toThrow(
      /too large/,
    )
  })

  it('missing lists', () => {
    const doc = json()
    delete doc.graph.partnerships
    rejects(doc, /partnerships are missing/)
  })
})
