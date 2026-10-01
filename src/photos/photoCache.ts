import { useEffect, useReducer } from 'react'
import { loadPhoto, savePhoto } from '../storage/photos'

/**
 * Object URLs for stored photos, by id. Photo ids never change, so an entry
 * never goes stale; the cache lives as long as the page.
 */
const resolved = new Map<string, string | null>()
const loading = new Map<string, Promise<void>>()

function load(id: string): Promise<void> {
  let promise = loading.get(id)
  if (!promise) {
    promise = loadPhoto(id).then(
      (blob) => void resolved.set(id, blob ? URL.createObjectURL(blob) : null),
      () => void resolved.set(id, null),
    )
    loading.set(id, promise)
  }
  return promise
}

/** Stores a new photo and makes it available to `usePhotoUrl` straight away. */
export async function storePhoto(blob: Blob): Promise<string> {
  const id = await savePhoto(blob)
  resolved.set(id, URL.createObjectURL(blob))
  return id
}

/** The URL to show a person's photo, or null while loading or if there's none. */
export function usePhotoUrl(photoId: string | undefined): string | null {
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!photoId || resolved.has(photoId)) return
    let cancelled = false
    void load(photoId).then(() => {
      if (!cancelled) rerender()
    })
    return () => {
      cancelled = true
    }
  }, [photoId])

  return photoId ? (resolved.get(photoId) ?? null) : null
}
