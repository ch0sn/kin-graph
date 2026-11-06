import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { squareCrop, type Crop } from '../photos/crop'
import { storePhoto } from '../photos/photoCache'
import {
  loadPhotoSource,
  PhotoError,
  preparePhoto,
  type PhotoSource,
} from '../photos/preparePhoto'

interface PendingPhoto {
  blob: Blob
  url: string
  /** The original image and the crop taken from it, for adjusting later. */
  source: PhotoSource
  crop: Crop
}

export interface PersonPhoto {
  busy: boolean
  /** Stores a newly chosen photo. `null` means storing failed; '' means there is no photo. */
  store: () => Promise<string | null>
  cancelCrop: () => void
  photoId: string
  pendingUrl: string | null
  canAdjust: boolean
  error: string | null
  chooseFile: (file: File) => void
  confirmCrop: (crop: Crop) => void
  remove: () => void
  adjust: () => void
  cropping: { source: PhotoSource; crop: Crop } | null
}

/**
 * Photo picking for a person form. The blob stays here until `store`, so a
 * rejected save can retry without writing the file twice.
 */
export function usePersonPhoto(photoId: string, onPhotoId: (photoId: string) => void): PersonPhoto {
  const { t } = useT()
  const [pending, setPending] = useState<PendingPhoto | null>(null)
  const [cropping, setCropping] = useState<{ source: PhotoSource; crop: Crop } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Release image memory once a photo or its original are no longer needed.
  useEffect(() => () => void (pending && URL.revokeObjectURL(pending.url)), [pending])
  const source = pending?.source
  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source])

  const showError = (caught: unknown) =>
    setError(caught instanceof PhotoError ? caught.message : t('photo.unusable'))

  const chooseFile = async (file: File) => {
    try {
      const picked = await loadPhotoSource(file)
      setCropping({ source: picked, crop: squareCrop(picked.width, picked.height) })
      setError(null)
    } catch (caught) {
      showError(caught)
    }
  }

  const confirmCrop = async (crop: Crop) => {
    if (!cropping) return
    const picked = cropping.source
    setCropping(null)
    try {
      const blob = await preparePhoto(picked.file, crop)
      setPending({ blob, url: URL.createObjectURL(blob), source: picked, crop })
    } catch (caught) {
      showError(caught)
      if (picked !== source) URL.revokeObjectURL(picked.url)
    }
  }

  const cancelCrop = () => {
    // A newly picked image that was never used can go; one being re-adjusted stays.
    if (cropping && cropping.source !== source) URL.revokeObjectURL(cropping.source.url)
    setCropping(null)
  }

  const remove = () => {
    setPending(null)
    onPhotoId('')
  }

  const adjust = () => {
    if (pending) setCropping({ source: pending.source, crop: pending.crop })
  }

  const store = async (): Promise<string | null> => {
    if (!pending) return photoId
    setBusy(true)
    try {
      const id = await storePhoto(pending.blob)
      // Stored now, so a retry after a rejected edit doesn't store it twice.
      onPhotoId(id)
      setPending(null)
      return id
    } catch {
      setError(t('photo.storeFailed'))
      return null
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    store,
    cancelCrop,
    photoId,
    pendingUrl: pending?.url ?? null,
    canAdjust: pending !== null,
    error,
    chooseFile: (file) => void chooseFile(file),
    confirmCrop: (crop) => void confirmCrop(crop),
    remove,
    adjust,
    cropping,
  }
}
