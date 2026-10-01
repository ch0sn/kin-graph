import { Background, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { motion } from 'motion/react'

const nodes: Node[] = [
  { id: 'me', position: { x: 0, y: 0 }, data: { label: 'You' } },
  { id: 'mother', position: { x: -120, y: -140 }, data: { label: 'Mother' } },
  { id: 'father', position: { x: 120, y: -140 }, data: { label: 'Father' } },
]

const edges: Edge[] = [
  { id: 'mother-me', source: 'mother', target: 'me', type: 'smoothstep' },
  { id: 'father-me', source: 'father', target: 'me', type: 'smoothstep' },
]

function App() {
  return (
    <div className="flex h-full flex-col">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur"
      >
        <h1 className="font-serif text-xl tracking-tight">KinGraph</h1>
      </motion.header>
      <main className="flex-1">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
        </ReactFlow>
      </main>
    </div>
  )
}

export default App
