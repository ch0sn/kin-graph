import { roundCrop, squareCrop, type Crop, type ImageSize } from './crop'

/** Photos are shown in small circles, so a 320px square is plenty even on 3× screens. */
export const PHOTO_SIZE = 320
const JPEG_QUALITY = 0.85

export class PhotoError extends Error {
  override name = 'PhotoError'
}

const UNREADABLE = 'This image couldn’t be opened. Try a JPEG or PNG photo.'

/** A chosen image file, ready to be cropped. */
export interface PhotoSource extends ImageSize {
  file: Blob
  /** An object URL for showing the image; revoke it when done. */
  url: string
}

export async function loadPhotoSource(file: Blob): Promise<PhotoSource> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoError(UNREADABLE)
  }
  // Browsers apply the photo's own rotation (EXIF) to these dimensions, as
  // createImageBitmap does below with `imageOrientation: 'from-image'`.
  return { file, url, width: image.naturalWidth, height: image.naturalHeight }
}

/**
 * Cuts the chosen square out of an image and shrinks it to a small JPEG, on
 * the device. Without a crop, takes the largest square, nearer the top for
 * portraits.
 */
export async function preparePhoto(file: Blob, crop?: Crop): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError(UNREADABLE)
  }

  const { sx, sy, side } = roundCrop(crop ?? squareCrop(bitmap.width, bitmap.height), bitmap)
  const size = Math.min(PHOTO_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new PhotoError('This browser can’t process photos.')
  // JPEG has no transparency; give transparent images a white background.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, size, size)
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError('The photo couldn’t be saved.'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  )
}
