import { ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '../ui/fields'
import { MAX_ZOOM, panCrop, zoomCrop, zoomOf, type Crop } from './crop'
import type { PhotoSource } from './preparePhoto'

interface PhotoCropDialogProps {
  /** The image being cropped; the dialog is open while this is set. */
  source: PhotoSource | null
  initialCrop: Crop | null
  onConfirm: (crop: Crop) => void
  onCancel: () => void
}

/**
 * Lets someone position a photo inside the circle it will be shown in: drag
 * to move, pinch, scroll or use the slider to zoom, or use the keyboard.
 */
export function PhotoCropDialog({ source, initialCrop, onConfirm, onCancel }: PhotoCropDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const open = source !== null && initialCrop !== null

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-crop-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_160ms_ease-out]"
    >
      {/* Remount per image so each starts from its own initial crop. */}
      {source && initialCrop && (
        <Cropper
          key={source.url}
          source={source}
          initialCrop={initialCrop}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </dialog>
  )
}

function Cropper({
  source,
  initialCrop,
  onConfirm,
  onCancel,
}: {
  source: PhotoSource
  initialCrop: Crop
  onConfirm: (crop: Crop) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState(initialCrop)
  const area = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  /** A position within the crop area, as fractions of its width. */
  const toFraction = (clientX: number, clientY: number) => {
    const rect = area.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
  }

  // Scroll-wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const element = area.current
    if (!element) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const anchor = toFraction(e.clientX, e.clientY)
      setCrop((c) => zoomCrop(c, Math.exp(-e.deltaY * 0.0015), source, anchor))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [source])

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, toFraction(e.clientX, e.clientY))
  }

  const onPointerMove = (e: PointerEvent) => {
    const previous = pointers.current.get(e.pointerId)
    if (!previous) return
    const before = [...pointers.current.values()]
    const current = toFraction(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, current)
    const after = [...pointers.current.values()]

    if (after.length === 1) {
      setCrop((c) => panCrop(c, current.x - previous.x, current.y - previous.y, source))
    } else if (after.length === 2) {
      // Pinch: zoom by the change in finger distance around their midpoint,
      // and pan by how far the midpoint moved.
      const [a0, b0] = before
      const [a1, b1] = after
      const factor = distance(a1, b1) / Math.max(distance(a0, b0), 0.001)
      const mid0 = midpoint(a0, b0)
      const mid1 = midpoint(a1, b1)
      setCrop((c) =>
        panCrop(zoomCrop(c, factor, source, mid1), mid1.x - mid0.x, mid1.y - mid0.y, source),
      )
    }
  }

  const onPointerEnd = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.025
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (e.key in moves) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      setCrop((c) => panCrop(c, dx, dy, source))
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      setCrop((c) => zoomCrop(c, 1.1, source))
    } else if (e.key === '-') {
      e.preventDefault()
      setCrop((c) => zoomCrop(c, 1 / 1.1, source))
    }
  }

  const zoom = zoomOf(crop, source)

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 id="photo-crop-title" className="font-serif text-xl leading-tight">
          Adjust photo
        </h2>
        <p className="mt-1 text-sm text-stone-500">Drag to move · pinch or scroll to zoom</p>
      </div>

      <div
        ref={area}
        tabIndex={0}
        role="group"
        aria-label="Photo position. Use the arrow keys to move it and plus or minus to zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-2xl bg-black select-none focus-visible:ring-4 focus-visible:ring-stone-300 focus-visible:outline-none active:cursor-grabbing"
      >
        <img
          src={source.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            left: `${(-crop.sx / crop.side) * 100}%`,
            top: `${(-crop.sy / crop.side) * 100}%`,
            width: `${(source.width / crop.side) * 100}%`,
            height: `${(source.height / crop.side) * 100}%`,
          }}
        />
        {/* Dim everything outside the circle the photo is shown in. */}
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(28_25_23/0.55)] ring-2 ring-[rgb(255_255_255/0.8)]" />
      </div>

      <div className="flex items-center gap-3 text-stone-500">
        <ZoomOut className="size-4 shrink-0" aria-hidden />
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setCrop((c) => zoomCrop(c, Number(e.target.value) / zoomOf(c, source), source))}
          className="w-full accent-stone-900"
        />
        <ZoomIn className="size-4 shrink-0" aria-hidden />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onConfirm(crop)} autoFocus>
          Use photo
        </Button>
      </div>
    </div>
  )
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
