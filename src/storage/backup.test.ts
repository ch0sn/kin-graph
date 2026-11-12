import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { createGraph, updatePerson } from '../model'
import { backupFileName, createBackup, readBackupFile } from './backup'
import { TreeFileError } from './treeDocument'

describe('backupFileName', () => {
  it("leads with the root's name, then kingraph and the local date", () => {
    expect(backupFileName(sampleFamily(), new Date(2026, 9, 1))).toBe(
      'joseph_kingraph_2026-10-01.json',
    )
  })

  it('simplifies accents and symbols, and keeps names in other scripts', () => {
    const date = new Date(2026, 0, 5)
    expect(backupFileName(createGraph({ names: [{ given: 'Zoë', surnames: ["O'Brien"] }] }), date)).toBe(
      'zoe-o-brien_kingraph_2026-01-05.json',
    )
    expect(backupFileName(createGraph({ names: [{ given: '민준', surnames: ['김'] }] }), date)).toBe(
      '김민준_kingraph_2026-01-05.json',
    )
    expect(backupFileName(createGraph({ names: [{ given: '李' }] }), date)).toBe(
      '李_kingraph_2026-01-05.json',
    )
  })

  it('omits a name that has no letters or digits', () => {
    expect(backupFileName(createGraph({ names: [{ given: '…' }] }), new Date(2026, 0, 5))).toBe(
      'kingraph_2026-01-05.json',
    )
  })
})

describe('createBackup / readBackupFile', () => {
  it('reads back a backup without photos', async () => {
    const graph = sampleFamily()
    const backup = await readBackupFile(await createBackup(graph, new Map()))
    expect(backup.graph).toEqual(graph)
    expect(backup.photos.size).toBe(0)
  })

  it('carries the photos people use, byte for byte', async () => {
    const graph = sampleFamily()
    const withPhoto = updatePerson(graph, graph.managerId, { photoId: 'face-1' })
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256)
    const photos = new Map([
      ['face-1', new Blob([bytes], { type: 'image/jpeg' })],
      ['unused', new Blob(['x'], { type: 'image/jpeg' })],
    ])

    const file = await createBackup(withPhoto, photos)
    const backup = await readBackupFile(file)

    expect([...backup.photos.keys()]).toEqual(['face-1'])
    const restored = backup.photos.get('face-1')!
    expect(restored.type).toBe('image/jpeg')
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(bytes)
  })

  it('rejects files that are not JSON or not KinGraph trees', async () => {
    await expect(readBackupFile(new Blob(['not json']))).rejects.toThrow(TreeFileError)
    await expect(readBackupFile(new Blob(['{"hello": 1}']))).rejects.toThrow(
      /isn’t a KinGraph/,
    )
  })
})
