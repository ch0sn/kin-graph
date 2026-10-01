import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import { createGraph } from '../model'
import { backupFileName, createBackup, readBackupFile } from './backup'
import { TreeFileError } from './treeDocument'

describe('backupFileName', () => {
  it("includes the manager's name and the local date", () => {
    expect(backupFileName(sampleFamily(), new Date(2026, 9, 1))).toBe(
      'kingraph-alex-morgan-2026-10-01.json',
    )
  })

  it('simplifies accents and symbols, and copes with no usable name', () => {
    const date = new Date(2026, 0, 5)
    expect(backupFileName(createGraph({ givenName: 'Zoë', familyName: "O'Brien" }), date)).toBe(
      'kingraph-zoe-o-brien-2026-01-05.json',
    )
    expect(backupFileName(createGraph({ givenName: '李' }), date)).toBe(
      'kingraph-2026-01-05.json',
    )
  })
})

describe('readBackupFile', () => {
  it('reads back a backup', async () => {
    const graph = sampleFamily()
    expect(await readBackupFile(createBackup(graph))).toEqual(graph)
  })

  it('rejects files that are not JSON or not KinGraph trees', async () => {
    await expect(readBackupFile(new Blob(['not json']))).rejects.toThrow(TreeFileError)
    await expect(readBackupFile(new Blob(['{"hello": 1}']))).rejects.toThrow(
      /isn’t a KinGraph/,
    )
  })
})
