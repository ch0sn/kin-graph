import { t } from '../i18n'
import { fullName, type FamilyGraph } from '../model'
import { toGedcom } from '../gedcom/export'
import { loadPhotos } from './photos'
import { parseBackup, toDocument, TreeFileError, type Backup } from './treeDocument'

/** e.g. "kingraph-alex-morgan-2026-10-01.json", dated in local time. */
export function backupFileName(graph: FamilyGraph, now = new Date(), extension = 'json'): string {
  const manager = graph.people[graph.managerId]
  const slug = fullName(manager)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return ['kingraph', slug, date].filter(Boolean).join('-') + `.${extension}`
}

export function photoIdsOf(graph: FamilyGraph): string[] {
  return Object.values(graph.people).flatMap((p) => (p.photoId ? [p.photoId] : []))
}

/** A backup file holding the tree and the photos its people use. */
export async function createBackup(
  graph: FamilyGraph,
  photos: Map<string, Blob>,
  now = new Date(),
): Promise<Blob> {
  const embedded: Record<string, string> = {}
  for (const id of photoIdsOf(graph)) {
    const photo = photos.get(id)
    if (photo) embedded[id] = await toDataUrl(photo)
  }
  const doc = toDocument(graph, now, Object.keys(embedded).length > 0 ? embedded : undefined)
  return new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
}

/** Saves a backup file, photos included, through the browser's normal download. */
export async function downloadBackup(graph: FamilyGraph): Promise<void> {
  const file = await createBackup(graph, await loadPhotos(photoIdsOf(graph)))
  saveFile(file, backupFileName(graph))
}

/** Saves a GEDCOM file, which other family tree programs can open. Photos aren't included. */
export function downloadGedcom(graph: FamilyGraph): void {
  const file = new Blob([toGedcom(graph)], { type: 'text/vnd.familysearch.gedcom;charset=utf-8' })
  saveFile(file, backupFileName(graph, new Date(), 'ged'))
}

function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reads a backup file, throwing a TreeFileError if it isn't a valid tree. */
export async function readBackupFile(file: Blob): Promise<Backup> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new TreeFileError(t('file.notKingraph'))
  }
  return parseBackup(data)
}

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // Convert in chunks; spreading a large array into one call can overflow the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`
}
