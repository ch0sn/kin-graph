import { describe, expect, it } from 'vitest'
import { addParent, createGraph, simpleName, type FamilyGraph } from '../model'
import { createGedcomArchive, importGedcomArchive } from './archive'
import { importGedcom } from './import'
import { createZip, isZip, readZip } from './zip'

const bytes = (text: string) => new TextEncoder().encode(text)
const text = (data: Uint8Array | undefined) => new TextDecoder().decode(data)
const jpeg = (content: string) => new Blob([content], { type: 'image/jpeg' })
/** Stands in for `preparePhoto`, which needs a browser: marks the photo as prepared. */
const prepare = async (image: Blob) => new Blob(['prepared:', image], { type: 'image/jpeg' })

/**
 * A zip made by another program (Python's zipfile, compressed), with the
 * .ged in a folder, a photo the .ged names by a Windows path, and the
 * extra files macOS adds.
 */
const FOREIGN_ZIP =
  'UEsDBBQAAAAIAMNZW10CXqnteQAAAIIAAAAQAAAATXkgVHJlZS90cmVlLmdlZDNQ8HB1dOHlMlRwd3Vx5uUyUghzDQpWMNUz1TPk5TJQcPA0dFDw9HPxBCnxc/R1VXDMy1PQ90lN1QeJ+Dt5uYI0uXn6uCo4W8WEFqcWFcfkpsYEZCaXlBalFseAlANV63kFuPNyGSu4+Qf5KmQVpIPMDgnyCeLlAgBQSwMEFAAAAAgAw1lbXbXMt20WAAAALAEAABkAAABNeSBUcmVlL21lZGlhL0FubiBMZWUuSlBHS0vMTtXNKkhN102qLEktThvl4uYCAFBLAwQUAAAACADDWVtdOZz7BgYAAAAEAAAAGwAAAF9fTUFDT1NYL015IFRyZWUvLl90cmVlLmdlZMsqzcsGAFBLAQIUAxQAAAAIAMNZW10CXqnteQAAAIIAAAAQAAAAAAAAAAAAAACAAQAAAABNeSBUcmVlL3RyZWUuZ2VkUEsBAhQDFAAAAAgAw1lbXbXMt20WAAAALAEAABkAAAAAAAAAAAAAAIABpwAAAE15IFRyZWUvbWVkaWEvQW5uIExlZS5KUEdQSwECFAMUAAAACADDWVtdOZz7BgYAAAAEAAAAGwAAAAAAAAAAAAAAgAH0AAAAX19NQUNPU1gvTXkgVHJlZS8uX3RyZWUuZ2VkUEsFBgAAAAADAAMAzgAAADMBAAAAAA=='

describe('zip', () => {
  it('reads back what it writes, with non-ASCII names', async () => {
    const zip = createZip([
      { name: 'tree.ged', data: bytes('0 HEAD') },
      { name: 'photos/김민준.jpg', data: new Uint8Array([0, 1, 2, 255]) },
    ])
    const data = new Uint8Array(await zip.arrayBuffer())
    expect(isZip(data)).toBe(true)
    const files = await readZip(data)
    expect([...files.keys()]).toEqual(['tree.ged', 'photos/김민준.jpg'])
    expect(text(files.get('tree.ged'))).toBe('0 HEAD')
    expect([...files.get('photos/김민준.jpg')!]).toEqual([0, 1, 2, 255])
  })

  it('reads compressed files from other programs', async () => {
    const files = await readZip(Uint8Array.from(atob(FOREIGN_ZIP), (c) => c.charCodeAt(0)))
    expect(text(files.get('My Tree/tree.ged'))).toMatch(/^0 HEAD/)
    expect(text(files.get('My Tree/media/Ann Lee.JPG'))).toBe('fake-jpeg-bytes'.repeat(20))
  })

  it('rejects what is not a zip', async () => {
    expect(isZip(bytes('0 HEAD'))).toBe(false)
    await expect(readZip(bytes('not a zip at all, just some text here'))).rejects.toThrow()
  })
})

describe('photos in GEDCOM', () => {
  /** A child with a photo whose parent has one too, and a parent without. */
  function family(): { graph: FamilyGraph; photos: Map<string, Blob> } {
    let graph = createGraph({ names: [simpleName('Kid')], photoId: 'p-kid', birthDate: '2000' })
    graph = addParent(graph, graph.managerId, { names: [simpleName('Mum')], photoId: 'p-mum', birthDate: '1970' }).graph
    graph = addParent(graph, graph.managerId, { names: [simpleName('Dad')], birthDate: '1900', deathDate: '1980' }).graph
    return { graph, photos: new Map([['p-kid', jpeg('kid')], ['p-mum', jpeg('mum')], ['unused', jpeg('x')]]) }
  }
  const photoOf = async (result: Awaited<ReturnType<typeof importGedcomArchive>>, name: string) => {
    const person = Object.values(result.graph.people).find((p) => p.names[0].given === name)!
    return person.photoId && (await result.photos.get(person.photoId)?.text())
  }

  it('round trips each person’s photo through a .zip, in both versions', async () => {
    for (const version of ['5.5.1', '7.0'] as const) {
      const { graph, photos } = family()
      const zip = await createGedcomArchive(graph, 'tree', photos, { version })
      const files = await readZip(new Uint8Array(await zip.arrayBuffer()))
      expect([...files.keys()].sort()).toEqual(['photos/1.jpg', 'photos/2.jpg', 'tree.ged'])
      expect(text(files.get('tree.ged'))).toContain(version === '7.0' ? '2 FORM image/jpeg' : '2 FORM jpg')

      const result = await importGedcomArchive(new Uint8Array(await zip.arrayBuffer()), prepare)
      expect(await photoOf(result, 'Kid')).toBe('prepared:kid')
      expect(await photoOf(result, 'Mum')).toBe('prepared:mum')
      expect(await photoOf(result, 'Dad')).toBeUndefined()
      expect(result.report).toMatchObject({ missingPhotos: 0, unsupported: {} })
    }
  })

  it('leaves out the photos of people hidden as living', async () => {
    const { graph, photos } = family()
    const now = new Date(2026, 0, 1)
    const zip = await createGedcomArchive(graph, 'tree', photos, { living: 'anonymise', now })
    const files = await readZip(new Uint8Array(await zip.arrayBuffer()))
    expect([...files.keys()]).toEqual(['tree.ged'])
    expect(text(files.get('tree.ged'))).not.toContain('OBJE')
  })

  it('reports photos that did not come with the file, or could not be read', async () => {
    const { graph, photos } = family()
    const zip = await createGedcomArchive(graph, 'tree', photos)
    const ged = (await readZip(new Uint8Array(await zip.arrayBuffer()))).get('tree.ged')!
    const alone = await importGedcomArchive(ged, prepare)
    expect(alone.report).toMatchObject({ missingPhotos: 2, unsupported: {} })
    expect(alone.photos.size).toBe(0)

    const broken = await importGedcomArchive(new Uint8Array(await zip.arrayBuffer()), async () => {
      throw new Error('unreadable')
    })
    expect(broken.report.missingPhotos).toBe(2)
    expect(Object.values(broken.graph.people).every((p) => !p.photoId)).toBe(true)
  })

  it('finds photos a file names by a path from another computer', async () => {
    const result = await importGedcomArchive(Uint8Array.from(atob(FOREIGN_ZIP), (c) => c.charCodeAt(0)), prepare)
    expect(result.report.missingPhotos).toBe(0)
    expect(await photoOf(result, 'Ann')).toBe('prepared:' + 'fake-jpeg-bytes'.repeat(20))
  })

  it('reads inline photos and keeps media that are not images on the report', () => {
    const { photoFiles, report, graph } = importGedcom(
      [
        '0 HEAD', '1 GEDC', '2 VERS 5.5.1',
        '0 @I1@ INDI', '1 NAME A', '1 OBJE', '2 FILE ./a.png', '1 OBJE @M1@',
        '0 @I2@ INDI', '1 NAME B', '1 OBJE', '2 FORM jpeg', '2 FILE b',
        '0 @M1@ OBJE', '1 FILE letter.pdf', '2 FORM pdf',
        '0 @M2@ OBJE', '1 FILE nobody.jpg',
        '0 TRLR',
      ].join('\n'),
    )
    const [a, b] = Object.keys(graph.people)
    expect(photoFiles).toEqual({ [a]: './a.png', [b]: 'b' })
    expect(report.unsupported).toEqual({ OBJE: 2 })
  })
})
