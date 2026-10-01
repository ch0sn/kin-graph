import { useCallback, useEffect, useState } from 'react'
import type { FamilyGraph } from '../model'
import { createAutosaver, type SaveState } from './autosave'
import { photoIdsOf } from './backup'
import * as db from './db'
import { prunePhotos } from './photos'

export type TreeState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; graph: FamilyGraph }
  | { status: 'damaged'; message: string }

export interface StoredTree {
  tree: TreeState
  saveState: SaveState
  /** Whether the browser agreed not to clear our data; null until asked. */
  persisted: boolean | null
  /** Records an edit; it's saved once edits pause. */
  setGraph: (graph: FamilyGraph) => void
  /** Starts or imports a whole tree, saving it straight away. */
  replaceTree: (graph: FamilyGraph) => Promise<void>
  /** Removes the saved tree from this device. */
  clearTree: () => Promise<void>
}

type TabMessage = 'saved' | 'cleared'

/** Tells other open tabs when this one saves; a channel never hears its own messages. */
const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('kingraph')
const notifyTabs = (message: TabMessage) => tabs?.postMessage(message)

/**
 * The family tree saved on this device. Edits are saved automatically and
 * other open tabs reload when this one saves (the last save wins). A damaged
 * saved tree is never overwritten without the person choosing to.
 */
export function useStoredTree(): StoredTree {
  const [tree, setTree] = useState<TreeState>({ status: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [persisted, setPersisted] = useState<boolean | null>(null)

  const [autosaver] = useState(() =>
    createAutosaver<FamilyGraph>(
      async (graph) => {
        await db.saveTree(graph)
        notifyTabs('saved')
      },
      { onStateChange: setSaveState },
    ),
  )

  useEffect(() => {
    let cancelled = false
    const reload = () =>
      db.loadTree().then((loaded) => {
        if (!cancelled) setTree(loaded)
        return loaded
      })
    void reload().then((loaded) => {
      // Tidy away photos of people who were removed or re-photographed. A
      // damaged tree may still refer to its photos, so leave those alone.
      if (loaded.status === 'damaged') return
      const keep = new Set(loaded.status === 'ready' ? photoIdsOf(loaded.graph) : [])
      prunePhotos(keep).catch(() => {})
    })

    // Pick up saves made in other tabs, unless this tab has unsaved edits
    // that are about to overwrite them anyway.
    const onTabMessage = (event: MessageEvent<TabMessage>) => {
      if (event.data === 'cleared') setTree({ status: 'empty' })
      else if (!autosaver.hasPending()) void reload()
    }
    tabs?.addEventListener('message', onTabMessage)

    // Write waiting edits before the page is hidden or closed.
    const flush = () => void autosaver.flush()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)

    return () => {
      cancelled = true
      tabs?.removeEventListener('message', onTabMessage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [autosaver])

  // Once there's a tree worth keeping, ask the browser to keep it.
  const hasTree = tree.status === 'ready'
  useEffect(() => {
    if (hasTree && persisted === null) {
      db.requestPersistence().then(setPersisted, () => setPersisted(false))
    }
  }, [hasTree, persisted])

  const setGraph = useCallback(
    (graph: FamilyGraph) => {
      setTree({ status: 'ready', graph })
      autosaver.schedule(graph)
    },
    [autosaver],
  )

  const replaceTree = useCallback(
    async (graph: FamilyGraph) => {
      setGraph(graph)
      await autosaver.flush()
    },
    [autosaver, setGraph],
  )

  const clearTree = useCallback(async () => {
    autosaver.cancel()
    await db.clearTree()
    await prunePhotos(new Set(), { olderThanMs: 0 }).catch(() => {})
    notifyTabs('cleared')
    setTree({ status: 'empty' })
    setSaveState('saved')
  }, [autosaver])

  return { tree, saveState, persisted, setGraph, replaceTree, clearTree }
}

/** Whether the first-run introduction has been seen; null while loading. */
export function useOnboarded(): [boolean | null, (done: boolean) => void] {
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    db.isOnboarded().then(
      (done) => !cancelled && setOnboarded(done),
      // If storage is unavailable, don't block the app behind the intro.
      () => !cancelled && setOnboarded(true),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((done: boolean) => {
    setOnboarded(done)
    void db.setOnboarded(done).catch(() => {})
  }, [])

  return [onboarded, update]
}
