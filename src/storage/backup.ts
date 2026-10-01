import { fullName, type FamilyGraph } from '../model'
import { parseTreeDocument, toDocument, TreeFileError } from './treeDocument'

/** e.g. "kingraph-alex-morgan-2026-10-01.json", dated in local time. */
export function backupFileName(graph: FamilyGraph, now = new Date()): string {
  const manager = graph.people[graph.managerId]
  const slug = fullName(manager)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return ['kingraph', slug, date].filter(Boolean).join('-') + '.json'
}

export function createBackup(graph: FamilyGraph, now = new Date()): Blob {
  return new Blob([JSON.stringify(toDocument(graph, now), null, 2)], {
    type: 'application/json',
  })
}

/** Saves a backup file through the browser's normal download. */
export function downloadBackup(graph: FamilyGraph): void {
  const url = URL.createObjectURL(createBackup(graph))
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(graph)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reads a backup file, throwing a TreeFileError if it isn't a valid tree. */
export async function readBackupFile(file: Blob): Promise<FamilyGraph> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new TreeFileError('This isn’t a KinGraph family tree file.')
  }
  return parseTreeDocument(data)
}
