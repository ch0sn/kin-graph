import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadPhoto, loadPhotos, prunePhotos, putPhotos, savePhoto } from './photos'

const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' })

describe('photo store', () => {
  it('saves photos under new ids and loads them back', async () => {
    const id = await savePhoto(jpeg('face'))
    const loaded = await loadPhoto(id)
    expect(await loaded?.text()).toBe('face')
    expect(loaded?.type).toBe('image/jpeg')
  })

  it('loads several photos, skipping missing ones', async () => {
    const a = await savePhoto(jpeg('a'))
    const photos = await loadPhotos([a, 'missing'])
    expect([...photos.keys()]).toEqual([a])
  })

  it('keeps ids when putting imported photos', async () => {
    await putPhotos(new Map([['imported-1', jpeg('x')]]))
    expect(await (await loadPhoto('imported-1'))?.text()).toBe('x')
  })

  it('prunes old photos nobody uses, keeping used and recent ones', async () => {
    const used = await savePhoto(jpeg('used'))
    const unused = await savePhoto(jpeg('unused'))
    const later = Date.now() + 2 * 60 * 60 * 1000

    // Just saved: kept even though unused, as an edit may still be on its way.
    await prunePhotos(new Set([used]))
    expect(await loadPhoto(unused)).toBeDefined()

    await prunePhotos(new Set([used]), { now: later })
    expect(await loadPhoto(unused)).toBeUndefined()
    expect(await loadPhoto(used)).toBeDefined()
  })
})
