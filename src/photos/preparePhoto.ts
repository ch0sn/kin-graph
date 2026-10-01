/** Photos are shown in small circles, so a 320px square is plenty even on 3× screens. */
export const PHOTO_SIZE = 320
const JPEG_QUALITY = 0.85

export class PhotoError extends Error {
  override name = 'PhotoError'
}

/**
 * The largest square to take from an image. Portraits are cropped nearer the
 * top, where a face usually is; landscapes are cropped from the centre.
 */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height)
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) * 0.25),
    side,
  }
}

/** Crops and shrinks a chosen image to a small square JPEG, on the device. */
export async function preparePhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('This image couldn’t be opened. Try a JPEG or PNG photo.')
  }

  const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height)
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
