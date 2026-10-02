import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type XYPosition,
} from '@xyflow/react'
import { Mars, Venus } from 'lucide-react'
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import type { FamilyGraph, PersonId } from '../model'
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
import { PersonNode, UnionNode } from './nodes'
import type { ThemePattern } from '../theme/themes'
import type { SiblingOrder } from './siblingOrder'

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
  /** Background pattern of the current theme. */
  pattern: ThemePattern
  /** Colours card borders by gender. */
  highlightGender: boolean
  onToggleHighlightGender: () => void
  selectedId: PersonId | null
  onSelect: (id: PersonId | null) => void
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
  pattern,
  highlightGender,
  onToggleHighlightGender,
  selectedId,
  onSelect,
}: FamilyTreeProps) {
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
  }, [graph, siblingOrder, reduceMotion])

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

  if (!layout) return null

  return (
    <TreeDisplayContext.Provider value={display}>
      <ReactFlow
        nodes={nodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={() => centerOn(graph.managerId, { duration: 0 })}
        onNodeClick={(_, node) => {
          if (node.type === 'person') onSelect(node.id)
        }}
        onPaneClick={() => onSelect(null)}
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
        <Panel position="bottom-right" className="flex gap-2">
          <button
            type="button"
            aria-label="Highlight male and female"
            aria-pressed={highlightGender}
            title={highlightGender ? 'Hide male and female colours' : 'Highlight male and female'}
            onClick={onToggleHighlightGender}
            className={[
              'flex items-center gap-0.5 rounded-full border px-3 py-2 shadow-sm backdrop-blur transition active:scale-95',
              highlightGender
                ? 'border-stone-900 bg-stone-900'
                : 'border-stone-200 bg-white/90 hover:bg-white',
            ].join(' ')}
          >
            <Mars
              className={`size-4 ${highlightGender ? 'text-blue-400' : 'text-stone-500'}`}
              aria-hidden
            />
            <Venus
              className={`size-4 ${highlightGender ? 'text-red-400' : 'text-stone-500'}`}
              aria-hidden
            />
          </button>
          <ToolbarButton onClick={() => fitView({ padding: 0.15, duration: 600 })}>
            Whole tree
          </ToolbarButton>
          <ToolbarButton onClick={() => centerOn(graph.managerId)}>Focus on you</ToolbarButton>
        </Panel>
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

function ToolbarButton(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-900 active:scale-95"
      {...props}
    />
  )
}
