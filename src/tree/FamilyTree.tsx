import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type XYPosition,
} from '@xyflow/react'
import { Expand, LocateFixed, Mars, Venus } from 'lucide-react'
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { genderCounts, type FamilyGraph, type PersonId } from '../model'
import { useT } from '../i18n'
import { elk } from './elk'
import {
  layoutFamily,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type FamilyLayout,
  type TreeNode,
} from './familyLayout'
import { TreeDisplayContext } from './display'
import { FamilyEdge } from './edges'
import { lineageEdgeIds } from './lineage'
import { PersonNode, UnionNode } from './nodes'
import type { ThemePattern } from '../theme/themes'
import type { SiblingOrder } from './siblingOrder'
import type { NameOrder } from '../model'

const PATTERNS = {
  dots: BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
} as const

const nodeTypes = { person: PersonNode, union: UnionNode }
const edgeTypes = { family: FamilyEdge }

/** Seconds each step away from the manager delays an element's first entrance. */
const ENTRANCE_STAGGER = 0.06
/** Where a selected person is placed, as a fraction of the height from the top, clear of the sheet. */
const SELECTED_VIEWPORT_Y = 0.28

interface FamilyTreeProps {
  graph: FamilyGraph
  siblingOrder: SiblingOrder
  /** Only used to redraw names when it changes; see `setPreferredNameOrder`. */
  nameOrder: NameOrder
  /** Background pattern of the current theme. */
  pattern: ThemePattern
  /** Colours card borders by gender. */
  highlightGender: boolean
  onToggleHighlightGender: () => void
  selectedId: PersonId | null
  onSelect: (id: PersonId | null) => void
  /** Where the view controls are drawn, outside the canvas; none are shown until it exists. */
  controlsSlot: HTMLElement | null
}

export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas {...props} />
    </ReactFlowProvider>
  )
}

function FamilyTreeCanvas({
  graph,
  siblingOrder,
  nameOrder,
  pattern,
  highlightGender,
  onToggleHighlightGender,
  selectedId,
  onSelect,
  controlsSlot,
}: FamilyTreeProps) {
  const { language } = useT()
  const display = useMemo(() => ({ highlightGender }), [highlightGender])
  /** The latest layout, i.e. where everything is heading. */
  const [layout, setLayout] = useState<FamilyLayout | null>(null)
  /** What's on screen, part-way through a transition between layouts. */
  const [shownNodes, setShownNodes] = useState<TreeNode[]>([])
  const shownRef = useRef<TreeNode[]>([])
  const reduceMotion = useReducedMotion()
  const { fitView, getZoom, setCenter } = useReactFlow()
  const viewportHeight = useStore((s) => s.height)

  useEffect(() => {
    let cancelled = false
    let tween: AnimationPlaybackControls | undefined
    layoutFamily(graph, elk, { siblingOrder }).then((next) => {
      if (cancelled) return
      const isFirst = shownRef.current.length === 0
      const target = withEntranceDelays(next, isFirst)
      setLayout(target)

      // Move people from where they are now to their new spots; newcomers
      // appear in place and animate in.
      const from = new Map(shownRef.current.map((n) => [n.id, n.position]))
      const show = (t: number) => {
        const frame = target.nodes.map((n) => {
          const start = from.get(n.id)
          return start ? { ...n, position: lerp(start, n.position, t) } : n
        })
        shownRef.current = frame
        setShownNodes(frame)
      }
      if (isFirst || reduceMotion) show(1)
      else tween = animate(0, 1, { duration: 0.5, ease: [0.22, 1, 0.36, 1], onUpdate: show })
    })
    return () => {
      cancelled = true
      tween?.stop()
    }
  }, [graph, siblingOrder, reduceMotion, language, nameOrder])

  /** The line the person clicked, whose lineage is lit up. */
  const [clickedEdgeId, setClickedEdgeId] = useState<string | null>(null)
  const edges = useMemo(() => {
    if (!layout || !clickedEdgeId) return layout?.edges ?? []
    const unionIds = new Set(layout.nodes.filter((n) => n.type === 'union').map((n) => n.id))
    const lit = lineageEdgeIds(layout.edges, unionIds, clickedEdgeId)
    return layout.edges.map((e) =>
      lit.has(e.id)
        ? { ...e, className: [e.className, 'edge-lineage'].filter(Boolean).join(' '), zIndex: 1 }
        : e,
    )
  }, [layout, clickedEdgeId])

  const nodes = useMemo(
    () => shownNodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [shownNodes, selectedId],
  )

  const centerOn = useCallback(
    (id: PersonId, { zoom = 1, offsetY = 0, duration = 600 } = {}) => {
      const node = layout?.nodes.find((n) => n.id === id)
      if (!node) return
      setCenter(
        node.position.x + PERSON_WIDTH / 2,
        node.position.y + PERSON_HEIGHT / 2 + offsetY / zoom,
        { zoom, duration },
      )
    },
    [layout, setCenter],
  )

  // Keep the selected person in view above the sheet, including after edits
  // move them.
  useEffect(() => {
    if (!selectedId) return
    centerOn(selectedId, {
      zoom: Math.max(getZoom(), 0.8),
      offsetY: viewportHeight * (0.5 - SELECTED_VIEWPORT_Y),
      duration: 500,
    })
  }, [selectedId, centerOn, getZoom, viewportHeight])

  const counts = useMemo(() => genderCounts(graph), [graph])

  if (!layout) return null

  return (
    <TreeDisplayContext.Provider value={display}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={() => centerOn(graph.managerId, { duration: 0 })}
        onNodeClick={(_, node) => {
          setClickedEdgeId(null)
          if (node.type === 'person') onSelect(node.id)
        }}
        onEdgeClick={(_, edge) => setClickedEdgeId(edge.id)}
        onPaneClick={() => {
          setClickedEdgeId(null)
          onSelect(null)
        }}
        edgesFocusable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        {pattern !== 'none' && (
          <Background
            variant={PATTERNS[pattern]}
            gap={24}
            size={pattern === 'dots' ? 1.5 : 1}
            color="var(--color-stone-300)"
          />
        )}
        {controlsSlot &&
          createPortal(
            <ViewControls
              onFocus={() => centerOn(graph.managerId)}
              onWhole={() => fitView({ padding: 0.15, duration: 600 })}
              highlightGender={highlightGender}
              onToggleHighlightGender={onToggleHighlightGender}
              counts={counts}
            />,
            controlsSlot,
          )}
      </ReactFlow>
    </TreeDisplayContext.Provider>
  )
}

/** Stagger the first render outward from the manager; later additions appear at once. */
function withEntranceDelays(layout: FamilyLayout, isFirst: boolean): FamilyLayout {
  const nodes = layout.nodes.map(
    (n) =>
      ({
        ...n,
        data: { ...n.data, entranceDelay: isFirst ? n.data.distance * ENTRANCE_STAGGER : 0 },
      }) as TreeNode,
  )
  const delayOf = new Map(nodes.map((n) => [n.id, n.data.entranceDelay ?? 0]))
  const edges = layout.edges.map((e) => {
    // Edges fade in once both of their ends have appeared.
    const delay = Math.max(delayOf.get(e.source) ?? 0, delayOf.get(e.target) ?? 0)
    return { ...e, style: { animationDelay: `${delay}s` } }
  })
  return { nodes, edges }
}

function lerp(from: XYPosition, to: XYPosition, t: number): XYPosition {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/**
 * The tree's view controls in a narrow box hanging from the header: icons
 * only, widening to the left on hover or focus to show what each does.
 */
function ViewControls({
  onFocus,
  onWhole,
  highlightGender,
  onToggleHighlightGender,
  counts,
}: {
  onFocus: () => void
  onWhole: () => void
  highlightGender: boolean
  onToggleHighlightGender: () => void
  counts: { male: number; female: number }
}) {
  const { t } = useT()
  return (
    <div
      role="toolbar"
      aria-label={t('tree.view')}
      // Flush with the window's right edge. 57px less the padding and left border leaves 40px: a 20px icon with 10px either side.
      className="group/view flex w-[57px] flex-col gap-1 overflow-hidden rounded-bl-2xl border border-t-0 border-r-0 border-stone-200 bg-white/80 p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur transition-[width] duration-200 ease-out focus-within:w-48 hover:w-48 motion-reduce:transition-none"
    >
      <ViewButton label={t('tree.focus')} onClick={onFocus}>
        <LocateFixed className="size-5" aria-hidden />
      </ViewButton>
      <ViewButton label={t('tree.whole')} onClick={onWhole}>
        <Expand className="size-5" aria-hidden />
      </ViewButton>
      <hr className="mx-1 my-0.5 border-stone-200" />
      <ViewButton
        label={t('tree.genderShort')}
        hint={highlightGender ? t('tree.highlightOff') : t('tree.highlight')}
        ariaLabel={
          highlightGender
            ? `${t('tree.highlight')}: ${t('tree.genderCounts', counts)}`
            : t('tree.highlight')
        }
        pressed={highlightGender}
        onClick={onToggleHighlightGender}
      >
        {/* Stacked, each with its count while the highlight is on. */}
        <span className="flex flex-col items-center gap-0.5 text-[11px] leading-none font-semibold tabular-nums">
          <Mars className={`size-4 ${highlightGender ? 'text-blue-500' : 'text-stone-500'}`} aria-hidden />
          {highlightGender && <span>{counts.male}</span>}
          <Venus className={`size-4 ${highlightGender ? 'text-red-500' : 'text-stone-500'}`} aria-hidden />
          {highlightGender && <span>{counts.female}</span>}
        </span>
      </ViewButton>
    </div>
  )
}

function ViewButton({
  label,
  hint = label,
  ariaLabel = label,
  pressed,
  onClick,
  children,
}: {
  label: string
  /** The tooltip, when it should say more than the label. */
  hint?: string
  ariaLabel?: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={hint}
      onClick={onClick}
      className={[
        // Reversed so the icon stays at the right edge while the box widens to the left.
        'flex w-full flex-row-reverse items-center gap-3 rounded-xl px-2.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        pressed ? 'bg-stone-100 text-stone-900' : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
      ].join(' ')}
    >
      <span className="flex w-5 shrink-0 justify-center">{children}</span>
      <span className="opacity-0 transition-opacity duration-150 group-focus-within/view:opacity-100 group-hover/view:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </button>
  )
}
