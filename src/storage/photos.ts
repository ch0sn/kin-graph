import { createStore, delMany, entries, get, getMany, set, setMany } from 'idb-keyval'

/**
 * Photos live in their own database so the tree itself stays small and fast
 * to save; people refer to them by `photoId`. A photo's id never changes, so
 * replacing a photo means storing a new one.
 */
const store = createStore('kingraph-photos', 'photos')

interface StoredPhoto {
  blob: Blob
  savedAt: number
}

export async function savePhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  await set(id, { blob, savedAt: Date.now() } satisfies StoredPhoto, store)
  return id
}

export async function loadPhoto(id: string): Promise<Blob | undefined> {
  return (await get<StoredPhoto>(id, store))?.blob
}

export async function loadPhotos(ids: string[]): Promise<Map<string, Blob>> {
  const found = await getMany<StoredPhoto | undefined>(ids, store)
  return new Map(
    ids.flatMap((id, i) => {
      const photo = found[i]
      return photo ? [[id, photo.blob] as const] : []
    }),
  )
}

/** Stores photos under their existing ids, e.g. from an imported backup. */
export function putPhotos(photos: Map<string, Blob>): Promise<void> {
  const savedAt = Date.now()
  return setMany(
    [...photos].map(([id, blob]) => [id, { blob, savedAt } satisfies StoredPhoto]),
    store,
  )
}

/**
 * Deletes photos no person refers to any more. Recent photos are kept, since
 * one may have been stored for an edit that hasn't been saved yet (possibly
 * in another tab).
 */
export async function prunePhotos(
  keepIds: ReadonlySet<string>,
  { olderThanMs = 60 * 60 * 1000, now = Date.now() } = {},
): Promise<number> {
  const unused = (await entries<string, StoredPhoto>(store))
    .filter(([id, photo]) => !keepIds.has(id) && now - photo.savedAt > olderThanMs)
    .map(([id]) => id)
  if (unused.length > 0) await delMany(unused, store)
  return unused.length
}
