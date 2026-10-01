/**
 * Square crops of an image, in the image's own pixels. Positions given by the
 * crop view (pan distances, zoom anchors) are fractions of the view's width,
 * so the maths doesn't depend on how large the view is drawn.
 */
export interface Crop {
  sx: number
  sy: number
  side: number
}

export interface ImageSize {
  width: number
  height: number
}

/** How far in a crop can zoom, relative to the largest possible square. */
export const MAX_ZOOM = 4

/**
 * The largest square to take from an image. Portraits are cropped nearer the
 * top, where a face usually is; landscapes are cropped from the centre.
 */
export function squareCrop(width: number, height: number): Crop {
  const side = Math.min(width, height)
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) * 0.25),
    side,
  }
}

/** 1 for the largest square, up to MAX_ZOOM. */
export function zoomOf(crop: Crop, image: ImageSize): number {
  return Math.min(image.width, image.height) / crop.side
}

/** Keeps a crop inside the image and within the zoom limits. */
export function clampCrop(crop: Crop, image: ImageSize): Crop {
  const largest = Math.min(image.width, image.height)
  const side = clamp(crop.side, largest / MAX_ZOOM, largest)
  return {
    sx: clamp(crop.sx, 0, image.width - side),
    sy: clamp(crop.sy, 0, image.height - side),
    side,
  }
}

/**
 * Moves the image under the crop, as when dragging it: dragging right by a
 * fifth of the view shows what was a fifth further left.
 */
export function panCrop(crop: Crop, dx: number, dy: number, image: ImageSize): Crop {
  return clampCrop({ ...crop, sx: crop.sx - dx * crop.side, sy: crop.sy - dy * crop.side }, image)
}

/**
 * Zooms by `factor` (above 1 zooms in) while keeping the point under
 * `anchor` in place, as with a pinch or scroll wheel. The anchor defaults to
 * the centre of the view.
 */
export function zoomCrop(
  crop: Crop,
  factor: number,
  image: ImageSize,
  anchor = { x: 0.5, y: 0.5 },
): Crop {
  const largest = Math.min(image.width, image.height)
  const side = clamp(crop.side / factor, largest / MAX_ZOOM, largest)
  const pointX = crop.sx + anchor.x * crop.side
  const pointY = crop.sy + anchor.y * crop.side
  return clampCrop({ sx: pointX - anchor.x * side, sy: pointY - anchor.y * side, side }, image)
}

/** Whole pixels, still inside the image, for drawing the final photo. */
export function roundCrop(crop: Crop, image: ImageSize): Crop {
  const side = Math.max(1, Math.min(Math.round(crop.side), image.width, image.height))
  return {
    sx: clamp(Math.round(crop.sx), 0, image.width - side),
    sy: clamp(Math.round(crop.sy), 0, image.height - side),
    side,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
