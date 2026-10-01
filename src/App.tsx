import { motion, MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'
import { sampleFamily } from './data/sampleFamily'
import type { PersonId } from './model'
import { PersonSheet } from './sheet/PersonSheet'
import { FamilyTree } from './tree/FamilyTree'

function App() {
  const [graph, setGraph] = useState(sampleFamily)
  const [selectedId, setSelectedId] = useState<PersonId | null>(null)
  const closeSheet = useCallback(() => setSelectedId(null), [])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full flex-col">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur"
        >
          <h1 className="font-serif text-xl tracking-tight">KinGraph</h1>
        </motion.header>
        <main className="flex-1">
          <FamilyTree graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
        </main>
      </div>
      <PersonSheet
        graph={graph}
        personId={selectedId}
        onChange={setGraph}
        onClose={closeSheet}
      />
    </MotionConfig>
  )
}

export default App
