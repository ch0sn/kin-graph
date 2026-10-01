import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import type { FamilyGraph } from '../model'
import { elk } from './elk'
import {
  layoutFamily,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type FamilyLayout,
} from './familyLayout'
import { PersonNode, UnionNode } from './nodes'

const nodeTypes = { person: PersonNode, union: UnionNode }

interface FamilyTreeProps {
  graph: FamilyGraph
}

export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas {...props} />
    </ReactFlowProvider>
  )
}

function FamilyTreeCanvas({ graph }: FamilyTreeProps) {
  const [layout, setLayout] = useState<FamilyLayout | null>(null)
  const { fitView, setCenter } = useReactFlow()

  useEffect(() => {
    let cancelled = false
    layoutFamily(graph, elk).then((next) => {
      if (!cancelled) setLayout(next)
    })
    return () => {
      cancelled = true
    }
  }, [graph])

  const focusManager = useCallback(
    (duration = 600) => {
      const manager = layout?.nodes.find((n) => n.id === graph.managerId)
      if (!manager) return
      setCenter(
        manager.position.x + PERSON_WIDTH / 2,
        manager.position.y + PERSON_HEIGHT / 2,
        { zoom: 1, duration },
      )
    },
    [graph.managerId, layout, setCenter],
  )

  if (!layout) return null

  return (
    <ReactFlow
      nodes={layout.nodes}
      edges={layout.edges}
      nodeTypes={nodeTypes}
      onInit={() => focusManager(0)}
      nodesDraggable={false}
      nodesConnectable={false}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#d6d3d1" />
      <Panel position="bottom-right" className="flex gap-2">
        <ToolbarButton onClick={() => fitView({ padding: 0.15, duration: 600 })}>
          Whole tree
        </ToolbarButton>
        <ToolbarButton onClick={() => focusManager()}>Focus on you</ToolbarButton>
      </Panel>
    </ReactFlow>
  )
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
