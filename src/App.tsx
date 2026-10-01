import { motion, MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'
import { AppMenu, SaveIndicator } from './app/AppMenu'
import type { FamilyGraph, PersonId } from './model'
import { DamagedTree } from './onboarding/DamagedTree'
import { Onboarding } from './onboarding/Onboarding'
import { Welcome } from './onboarding/Welcome'
import { PersonSheet } from './sheet/PersonSheet'
import { useOnboarded, useStoredTree, type StoredTree } from './storage/useStoredTree'
import { FamilyTree } from './tree/FamilyTree'

function App() {
  const stored = useStoredTree()
  const [onboarded, setOnboarded] = useOnboarded()
  const [replayingIntro, setReplayingIntro] = useState(false)
  const { tree } = stored

  let screen
  if (tree.status === 'loading' || onboarded === null) {
    screen = null
  } else if (!onboarded || replayingIntro) {
    screen = (
      <Onboarding
        onDone={() => {
          setOnboarded(true)
          setReplayingIntro(false)
        }}
      />
    )
  } else if (tree.status === 'empty') {
    screen = <Welcome onStart={stored.replaceTree} />
  } else if (tree.status === 'damaged') {
    screen = (
      <DamagedTree
        message={tree.message}
        onImport={stored.replaceTree}
        onStartOver={stored.clearTree}
      />
    )
  } else {
    screen = (
      <TreeScreen graph={tree.graph} stored={stored} onShowIntro={() => setReplayingIntro(true)} />
    )
  }

  return <MotionConfig reducedMotion="user">{screen}</MotionConfig>
}

function TreeScreen({
  graph,
  stored,
  onShowIntro,
}: {
  graph: FamilyGraph
  stored: StoredTree
  onShowIntro: () => void
}) {
  const [selectedId, setSelectedId] = useState<PersonId | null>(null)
  const closeSheet = useCallback(() => setSelectedId(null), [])

  return (
    <>
      <div className="flex h-full flex-col">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/80 py-2 pr-2 pl-4 backdrop-blur"
        >
          <h1 className="font-serif text-xl tracking-tight">KinGraph</h1>
          <div className="flex items-center gap-2">
            <SaveIndicator state={stored.saveState} />
            <AppMenu
              graph={graph}
              persisted={stored.persisted}
              onReplace={(next) => {
                setSelectedId(null)
                void stored.replaceTree(next)
              }}
              onStartOver={() => void stored.clearTree()}
              onShowIntro={onShowIntro}
            />
          </div>
        </motion.header>
        <main className="flex-1">
          {/* A different tree (import, new start) gets a fresh view and entrance. */}
          <FamilyTree
            key={graph.managerId}
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </main>
      </div>
      <PersonSheet
        graph={graph}
        personId={selectedId}
        onChange={stored.setGraph}
        onClose={closeSheet}
      />
    </>
  )
}

export default App
