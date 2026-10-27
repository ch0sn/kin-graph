import { t } from '../i18n'
import type { FamilyGraph } from '../model'
import { toGedcom, type GedcomOptions } from './export'
import { GedcomError, importGedcomFile, type GedcomImport } from './import'
import { applyLivingPolicy } from './privacy'
import { createZip, isZip, readZip, ZipError, type ZipEntry } from './zip'

/** The folder photos go in, next to the .ged file. */
const PHOTO_FOLDER = 'photos'

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * A .zip holding the GEDCOM file as `<name>.ged` and the photos its people
 * use in a `photos` folder, which the file points to with OBJE records.
 * People left out or anonymised as living lose their photo along with the rest.
 */
export async function createGedcomArchive(
  graph: FamilyGraph,
  name: string,
  photos: ReadonlyMap<string, Blob>,
  options: Omit<GedcomOptions, 'photos'> = {},
): Promise<Blob> {
  const shown = applyLivingPolicy(graph, options.living ?? 'include', options.now)
  const used = [...new Set(Object.values(shown.people).flatMap((p) => p.photoId ?? []))]
  const paths = new Map<string, string>()
  const entries: ZipEntry[] = []
  for (const [i, photoId] of used.filter((id) => photos.has(id)).entries()) {
    const blob = photos.get(photoId)!
    const path = `${PHOTO_FOLDER}/${i + 1}.${EXTENSIONS[blob.type] ?? 'jpg'}`
    paths.set(photoId, path)
    entries.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) })
  }
  const text = toGedcom(shown, { ...options, living: 'include', photos: paths })
  return createZip([{ name: `${name}.ged`, data: new TextEncoder().encode(text) }, ...entries])
}

export interface GedcomArchiveImport extends GedcomImport {
  /** Prepared photos by the id the graph's people now refer to; store them before the tree. */
  photos: Map<string, Blob>
}

/**
 * Reads a GEDCOM file, or a .zip with one and the photos it points to.
 * Photos are cropped and sized like any other (`prepare`); ones that are
 * missing or can't be read are counted in the report.
 */
export async function importGedcomArchive(
  bytes: Uint8Array,
  prepare: (image: Blob) => Promise<Blob>,
): Promise<GedcomArchiveImport> {
  let files = new Map<string, Uint8Array>()
  let gedcom = bytes
  let folder = ''
  if (isZip(bytes)) {
    try {
      files = await readZip(bytes)
    } catch (e) {
      if (e instanceof ZipError) throw new GedcomError(t('gedcom.badZip'))
      throw e
    }
    // The .ged nearest the top, ignoring the copies macOS adds.
    const name = [...files.keys()]
      .filter((n) => /\.ged(?:com)?$/i.test(n) && !n.startsWith('__MACOSX/'))
      .sort((a, b) => a.split('/').length - b.split('/').length)[0]
    if (!name) throw new GedcomError(t('gedcom.noGedcomInZip'))
    gedcom = files.get(name)!
    folder = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : ''
  }

  const result = importGedcomFile(gedcom)
  const photos = new Map<string, Blob>()
  const lookup = fileLookup(files, folder)
  for (const [personId, path] of Object.entries(result.photoFiles)) {
    const data = lookup(path)
    try {
      if (!data) throw new Error('missing')
      const photo = await prepare(new Blob([data as BlobPart], { type: imageType(path) }))
      const id = crypto.randomUUID()
      photos.set(id, photo)
      result.graph.people[personId].photoId = id
    } catch {
      result.report.missingPhotos++
    }
  }
  return { ...result, photos }
}

function imageType(path: string): string {
  const extension = /\.(\w+)$/.exec(path)?.[1].toLowerCase()
  return extension === 'jpg' || !extension ? 'image/jpeg' : `image/${extension}`
}

/**
 * Finds the file a GEDCOM path means. Programs write paths relative to the
 * .ged, with either slash, or as they were on the computer that made the
 * file (`C:\Photos\ann.jpg`), so this tries the path, then its name alone.
 */
function fileLookup(files: Map<string, Uint8Array>, folder: string) {
  const byPath = new Map([...files].map(([name, data]) => [name.toLowerCase(), data]))
  const byName = new Map<string, Uint8Array | null>()
  for (const [name, data] of files) {
    const base = name.slice(name.lastIndexOf('/') + 1).toLowerCase()
    // A name that appears twice can't say which file it is.
    byName.set(base, byName.has(base) ? null : data)
  }
  return (path: string): Uint8Array | undefined => {
    const clean = path
      .replace(/^file:\/\//i, '')
      .replace(/\\/g, '/')
      .replace(/^(?:\.\/)+/, '')
      .toLowerCase()
    const decoded = safeDecode(clean)
    for (const candidate of [folder.toLowerCase() + clean, clean, folder.toLowerCase() + decoded, decoded]) {
      const found = byPath.get(candidate)
      if (found) return found
    }
    return byName.get(decoded.slice(decoded.lastIndexOf('/') + 1)) ?? undefined
  }
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
