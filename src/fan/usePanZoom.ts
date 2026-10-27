import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

/** A zoom `k` and a shift (x, y), in the SVG's own units, applied to the drawing. */
export interface PanZoom {
  k: number
  x: number
  y: number
}

const IDENTITY: PanZoom = { k: 1, x: 0, y: 0 }
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
/** How far, in screen pixels, a pointer may wander before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 5

interface Pointer {
  /** Where the pointer is, in SVG units. */
  x: number
  y: number
  /** Where it went down, in screen pixels. */
  startX: number
  startY: number
}

/**
 * Panning and zooming an SVG drawing with the mouse wheel, by dragging, or
 * by pinching with two fingers. A press only becomes a drag once it moves,
 * so clicks on what's drawn still work; `wasDrag` tells them apart.
 */
export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>) {
  const [view, setView] = useState<PanZoom>(IDENTITY)
  const pointers = useRef(new Map<number, Pointer>())
  const dragged = useRef(false)
  const pinch = useRef<{ distance: number; mid: { x: number; y: number } } | null>(null)

  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      const ctm = svgRef.current?.getScreenCTM()
      if (!ctm) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return { x: p.x, y: p.y }
    },
    [svgRef],
  )

  /** Zooms by `factor`, keeping the point `at` (in SVG units) where it is. */
  const zoomAt = useCallback((at: { x: number; y: number }, factor: number) => {
    setView((v) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor))
      const r = k / v.k
      return { k, x: at.x - (at.x - v.x) * r, y: at.y - (at.y - v.y) * r }
    })
  }, [])

  // React's wheel listeners are passive, so the page would scroll too.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const at = toSvg(e.clientX, e.clientY)
      if (at) zoomAt(at, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [svgRef, toSvg, zoomAt])

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const at = toSvg(e.clientX, e.clientY)
    if (!at) return
    if (pointers.current.size === 0) dragged.current = false
    pointers.current.set(e.pointerId, { ...at, startX: e.clientX, startY: e.clientY })
    pinch.current = null
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const pointer = pointers.current.get(e.pointerId)
    const at = pointer && toSvg(e.clientX, e.clientY)
    if (!pointer || !at) return
    if (!dragged.current && Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) < DRAG_THRESHOLD) return
    if (!dragged.current) {
      dragged.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const previous = { x: pointer.x, y: pointer.y }
    pointers.current.set(e.pointerId, { ...pointer, ...at })

    if (pointers.current.size === 1) {
      setView((v) => ({ ...v, x: v.x + at.x - previous.x, y: v.y + at.y - previous.y }))
      return
    }
    const [a, b] = [...pointers.current.values()]
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (pinch.current) {
      const last = pinch.current
      setView((v) => ({ ...v, x: v.x + mid.x - last.mid.x, y: v.y + mid.y - last.mid.y }))
      zoomAt(mid, distance / last.distance)
    }
    pinch.current = { distance, mid }
  }

  const onPointerEnd = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    pinch.current = null
  }

  return {
    view,
    reset: useCallback(() => setView(IDENTITY), []),
    /** Whether the latest press moved the drawing, so it shouldn't count as a click. */
    wasDrag: () => dragged.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  }
}
