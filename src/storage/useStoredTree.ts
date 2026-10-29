import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyGraph, PersonId } from '../model'
import { createAutosaver, type Autosaver, type SaveState } from './autosave'
import { onBackupExported, photoIdsOf } from './backup'
import * as db from './db'
import { emptyHistory, record, redo as redoIn, undo as undoIn, type History } from './history'
import { prunePhotos } from './photos'
import { DEFAULT_SETTINGS, type Settings, type StartTabs } from './settings'
import { SNAPSHOT_INTERVAL_MS } from './snapshots'
import { notifyTabs, onTabMessage } from './tabs'
import {
  addTab,
  dropTree,
  EMPTY_WORKSPACE,
  ignoreIssue,
  linkTrees,
  openView as openViewIn,
  removeTab,
  showTree as showTreeIn,
  startingWorkspace,
  updateTab,
  type Tab,
  type TreeId,
  type TreeMeta,
  type TreeView,
  type Workspace,
} from './workspace'

export type TreeState =
  | { status: 'ready'; graph: FamilyGraph; savedAt?: number }
  | { status: 'damaged'; message: string }

interface Data {
  trees: TreeMeta[]
  /** Every saved tree, by id. They're small, and all are needed to tidy photos. */
  graphs: Record<TreeId, TreeState>
  workspace: Workspace
}

export interface StoredTrees extends Data {
  loading: boolean
  activeTab: Tab | null
  /** The least settled save across all trees. */
  saveState: SaveState
  /** When each tree was last saved, in ms, where known. */
  savedAt: Record<TreeId, number>
  /** Whether the browser agreed not to clear our data; null until asked. */
  persisted: boolean | null
  /** Which trees have edits to undo or redo. */
  undoable: Record<TreeId, { undo: boolean; redo: boolean }>
  selectTab: (tabId: string) => void
  /** Closes a tab; the tree stays saved. */
  closeTab: (tabId: string) => void
  /** Switches to a tree's tab, opening one if needed. */
  showTree: (treeId: TreeId) => void
  /** Shows a tree from someone's point of view, as a view with them as the root. */
  openView: (treeId: TreeId, personId: PersonId) => void
  /**
   * Saves a new tree and opens it: in place of `replaceTabId`'s tree, which
   * is then deleted, or in a new tab. `linkFrom` records whose tree it is.
   */
  createTree: (
    graph: FamilyGraph,
    options?: { replaceTabId?: string; linkFrom?: { treeId: TreeId; personId: PersonId } },
  ) => Promise<void>
  /** Records an edit, which can be undone; it's saved once edits pause. */
  setGraph: (treeId: TreeId, graph: FamilyGraph) => void
  /** Takes back a tree's latest edit. */
  undo: (treeId: TreeId) => void
  /** Makes an edit that was undone again. */
  redo: (treeId: TreeId) => void
  /** Puts an older version of a tree back, as an edit that can be undone. */
  restoreSnapshot: (treeId: TreeId, graph: FamilyGraph) => void
  /** Ignores one of the problems `checkTree` found in a tree, or stops ignoring it. */
  ignoreIssue: (treeId: TreeId, issueId: string, ignored: boolean) => void
  /** Replaces a tree's contents, saving straight away. */
  replaceGraph: (treeId: TreeId, graph: FamilyGraph) => Promise<void>
  /** Turns a view into a tree of its own, holding `graph`, and links it to the person. */
  forkView: (tabId: string, graph: FamilyGraph) => Promise<void>
  /** Remembers that edits in a view should change the viewed tree. */
  shareView: (tabId: string) => void
  /** Switches how a tab shows its tree: the tree itself, or a fan chart. */
  setTabView: (tabId: string, view: TreeView) => void
  /** Removes a tree from this device, closing its tabs. */
  deleteTree: (treeId: TreeId) => Promise<void>
}

const EMPTY: Data = { trees: [], graphs: {}, workspace: EMPTY_WORKSPACE }

const readyGraphs = (graphs: Record<TreeId, TreeState>) =>
  Object.values(graphs).flatMap((state) => (state.status === 'ready' ? [state.graph] : []))

/**
 * Deletes photos no tree or snapshot uses. A damaged tree may still refer to
 * its photos, so then nothing goes.
 */
function tidyPhotos(graphs: Record<TreeId, TreeState>) {
  if (Object.values(graphs).some((state) => state.status === 'damaged')) return
  void (async () => {
    const snapshots = (await Promise.all(Object.keys(graphs).map(db.loadSnapshots))).flat()
    const used = [...readyGraphs(graphs), ...snapshots.map((s) => s.graph)].flatMap(photoIdsOf)
    await prunePhotos(new Set(used))
  })().catch(() => {})
}

/** Whether `next` leaves out someone `previous` had, placeholder parents aside. */
const removesSomeone = (previous: FamilyGraph, next: FamilyGraph) =>
  Object.values(previous.people).some((person) => !person.isPlaceholder && !next.people[person.id])

async function loadGraphs(trees: TreeMeta[]): Promise<Record<TreeId, TreeState>> {
  const loaded = await Promise.all(trees.map((tree) => db.loadTree(tree.id)))
  return Object.fromEntries(
    trees.flatMap((tree, i) => {
      const state = loaded[i]
      return state.status === 'empty' ? [] : [[tree.id, state] as const]
    }),
  )
}

/**
 * The family trees saved on this device and the tabs open on them. Edits are
 * saved automatically, and other browser tabs reload a tree when this one
 * saves it (the last save wins). A damaged saved tree is never overwritten
 * without the person choosing to.
 *
 * Waits for `onStart` (from settings) before loading, to know which tabs to open.
 */
export function useStoredTrees(onStart: StartTabs | null): StoredTrees {
  const [data, setData] = useState<Data>(EMPTY)
  /** The latest data, for actions that run between renders. */
  const latest = useRef<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saveStates, setSaveStates] = useState<Record<TreeId, SaveState>>({})
  const [savedAt, setSavedAt] = useState<Record<TreeId, number>>({})
  const markSaved = useCallback(
    (treeId: TreeId, at = Date.now()) => setSavedAt((times) => ({ ...times, [treeId]: at })),
    [],
  )
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const autosavers = useRef(new Map<TreeId, Autosaver<FamilyGraph>>())
  /** Undo and redo, per tree. Only for this tab and this visit. */
  const histories = useRef(new Map<TreeId, History<FamilyGraph>>())
  const [undoable, setUndoable] = useState<StoredTrees['undoable']>({})
  const setHistory = useCallback((treeId: TreeId, history: History<FamilyGraph> | null) => {
    if (history) histories.current.set(treeId, history)
    else histories.current.delete(treeId)
    setUndoable((current) => {
      const { [treeId]: _old, ...rest } = current
      return history ? { ...rest, [treeId]: { undo: history.past.length > 0, redo: history.future.length > 0 } } : rest
    })
  }, [])
  /** When each tree was last copied as a snapshot, in ms. */
  const snapshotAt = useRef(new Map<TreeId, number>())
  const snapshot = useCallback((treeId: TreeId, graph: FamilyGraph, reason: Parameters<typeof db.saveSnapshot>[2]) => {
    snapshotAt.current.set(treeId, Date.now())
    void db.saveSnapshot(treeId, graph, reason).catch(() => {})
  }, [])

  const commit = useCallback((patch: Partial<Data>, { broadcast = true } = {}) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setData(next)
    if (patch.workspace) void db.saveWorkspace(patch.workspace).catch(() => {})
    if (patch.trees) {
      void db.saveTrees(patch.trees).then(() => broadcast && notifyTabs({ type: 'trees' }), () => {})
    }
  }, [])

  const autosaverFor = useCallback((treeId: TreeId) => {
    let autosaver = autosavers.current.get(treeId)
    if (!autosaver) {
      autosaver = createAutosaver<FamilyGraph>(
        async (graph) => {
          await db.saveTree(treeId, graph)
          markSaved(treeId)
          notifyTabs({ type: 'saved', treeId })
          if (Date.now() - (snapshotAt.current.get(treeId) ?? 0) > SNAPSHOT_INTERVAL_MS) {
            snapshot(treeId, graph, 'autosave')
          }
        },
        { onStateChange: (state) => setSaveStates((states) => ({ ...states, [treeId]: state })) },
      )
      autosavers.current.set(treeId, autosaver)
    }
    return autosaver
  }, [markSaved, snapshot])

  // Load once, with whichever start setting is in effect then.
  const startWith = useRef(onStart)
  startWith.current ??= onStart
  const started = onStart !== null
  useEffect(() => {
    const onStart = startWith.current
    if (!started || onStart === null) return
    let cancelled = false

    void (async () => {
      const trees = await db.loadTrees()
      const graphs = await loadGraphs(trees)
      // A tree whose data is missing can't be shown; forget it.
      const kept = trees.filter((tree) => graphs[tree.id])
      const workspace = startingWorkspace(await db.loadWorkspace(), kept, onStart)
      if (cancelled) return
      latest.current = { trees: kept, graphs, workspace }
      setData(latest.current)
      setSavedAt(
        Object.fromEntries(
          Object.entries(graphs).flatMap(([id, state]) =>
            state.status === 'ready' && state.savedAt ? [[id, state.savedAt]] : [],
          ),
        ),
      )
      setLoading(false)
      if (kept.length !== trees.length) void db.saveTrees(kept)
      void db.saveWorkspace(workspace).catch(() => {})
      // A copy of each tree as it was when this visit began.
      for (const [id, state] of Object.entries(graphs)) {
        if (state.status === 'ready') snapshot(id, state.graph, 'opened')
      }
      tidyPhotos(graphs)
    })()

    // Pick up changes made in other browser tabs, unless this one has
    // unsaved edits to that tree that are about to overwrite them anyway.
    const stopListening = onTabMessage(async (message) => {
      const current = latest.current
      if (message.type === 'saved') {
        if (autosavers.current.get(message.treeId)?.hasPending()) return
        const state = await db.loadTree(message.treeId)
        if (cancelled || state.status === 'empty') return
        if (state.status === 'ready' && state.savedAt) markSaved(message.treeId, state.savedAt)
        // Undoing here now would quietly take back the other tab's edits too.
        setHistory(message.treeId, null)
        commit({ graphs: { ...latest.current.graphs, [message.treeId]: state } })
      } else if (message.type === 'deleted') {
        const { [message.treeId]: _gone, ...graphs } = current.graphs
        let workspace = current.workspace
        for (const tab of workspace.tabs) {
          if (tab.treeId === message.treeId) workspace = removeTab(workspace, tab.id)
        }
        commit({ trees: dropTree(current.trees, message.treeId), graphs, workspace }, { broadcast: false })
      } else if (message.type === 'trees') {
        const trees = await db.loadTrees()
        const missing = trees.filter((tree) => !latest.current.graphs[tree.id])
        const added = await loadGraphs(missing)
        if (cancelled) return
        latest.current = {
          ...latest.current,
          trees: trees.filter((tree) => latest.current.graphs[tree.id] || added[tree.id]),
          graphs: { ...latest.current.graphs, ...added },
        }
        setData(latest.current)
      }
    })

    // Write waiting edits before the page is hidden or closed.
    const flush = () => {
      for (const autosaver of autosavers.current.values()) void autosaver.flush()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)

    return () => {
      cancelled = true
      stopListening()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [started, commit, markSaved, setHistory, snapshot])

  // A view whose root person was removed has nothing left to show.
  useEffect(() => {
    const orphans = data.workspace.tabs.filter((tab) => {
      const state = data.graphs[tab.treeId]
      return tab.viewRootId && state?.status === 'ready' && !state.graph.people[tab.viewRootId]
    })
    if (orphans.length === 0) return
    let workspace = latest.current.workspace
    for (const tab of orphans) workspace = removeTab(workspace, tab.id)
    commit({ workspace })
  }, [data, commit])

  // Once there's a tree worth keeping, ask the browser to keep it.
  const hasTree = readyGraphs(data.graphs).length > 0
  useEffect(() => {
    if (hasTree && persisted === null) {
      db.requestPersistence().then(setPersisted, () => setPersisted(false))
    }
  }, [hasTree, persisted])

  /** Shows and saves a tree's new contents, without touching its history. */
  const apply = useCallback(
    (treeId: TreeId, graph: FamilyGraph) => {
      commit({ graphs: { ...latest.current.graphs, [treeId]: { status: 'ready', graph } } })
      // Replaces any edit still waiting, so an undone edit is never written.
      autosaverFor(treeId).schedule(graph)
    },
    [autosaverFor, commit],
  )

  const setGraph = useCallback(
    (treeId: TreeId, graph: FamilyGraph) => {
      const state = latest.current.graphs[treeId]
      if (state?.status === 'ready') {
        if (state.graph === graph) return
        setHistory(treeId, record(histories.current.get(treeId) ?? emptyHistory(), state.graph))
        if (removesSomeone(state.graph, graph)) snapshot(treeId, state.graph, 'beforeRemove')
      }
      apply(treeId, graph)
    },
    [apply, setHistory, snapshot],
  )

  const step = useCallback(
    (treeId: TreeId, direction: typeof undoIn) => {
      const state = latest.current.graphs[treeId]
      const history = histories.current.get(treeId)
      if (state?.status !== 'ready' || !history) return
      const stepped = direction(history, state.graph)
      if (!stepped) return
      setHistory(treeId, stepped.history)
      apply(treeId, stepped.value)
    },
    [apply, setHistory],
  )

  const restoreSnapshot = useCallback(
    (treeId: TreeId, graph: FamilyGraph) => {
      const state = latest.current.graphs[treeId]
      if (state?.status === 'ready') snapshot(treeId, state.graph, 'beforeRestore')
      setGraph(treeId, graph)
    },
    [setGraph, snapshot],
  )

  const replaceGraph = useCallback(
    async (treeId: TreeId, graph: FamilyGraph) => {
      setGraph(treeId, graph)
      await autosaverFor(treeId).flush()
    },
    [autosaverFor, setGraph],
  )

  const deleteTree = useCallback(
    async (treeId: TreeId) => {
      autosavers.current.get(treeId)?.cancel()
      autosavers.current.delete(treeId)
      setHistory(treeId, null)
      await db.deleteTree(treeId)
      const current = latest.current
      const { [treeId]: _gone, ...graphs } = current.graphs
      let workspace = current.workspace
      for (const tab of workspace.tabs) {
        if (tab.treeId === treeId) workspace = removeTab(workspace, tab.id)
      }
      commit({ trees: dropTree(current.trees, treeId), graphs, workspace }, { broadcast: false })
      notifyTabs({ type: 'deleted', treeId })
      setSaveStates(({ [treeId]: _done, ...states }) => states)
      tidyPhotos(graphs)
    },
    [commit, setHistory],
  )

  /** Saves `graph` as a new tree and returns its id. */
  const addTree = useCallback(
    async (graph: FamilyGraph, own: boolean): Promise<TreeId> => {
      const id = crypto.randomUUID()
      await db.saveTree(id, graph)
      markSaved(id)
      const current = latest.current
      const meta: TreeMeta = { id, createdAt: Date.now(), ...(own && { own: true }) }
      latest.current = {
        ...current,
        trees: [...current.trees, meta],
        graphs: { ...current.graphs, [id]: { status: 'ready', graph } },
      }
      return id
    },
    [markSaved],
  )

  const createTree = useCallback<StoredTrees['createTree']>(
    async (graph, { replaceTabId, linkFrom } = {}) => {
      const current = latest.current
      const replacing = current.workspace.tabs.find((tab) => tab.id === replaceTabId)
      const replacedTree = replacing && current.trees.find((tree) => tree.id === replacing.treeId)
      const own = !current.trees.some((tree) => tree.own) || Boolean(replacedTree?.own)
      const id = await addTree(graph, own)
      let { trees, workspace } = latest.current
      if (replacedTree?.own) trees = trees.map((tree) => (tree.id === replacedTree.id ? { ...tree, own: false } : tree))
      if (linkFrom) trees = linkTrees(trees, linkFrom.treeId, linkFrom.personId, id)
      workspace = replacing
        ? { ...updateTab(workspace, replacing.id, { treeId: id, viewRootId: undefined, editChoice: undefined }), activeTabId: replacing.id }
        : addTab(workspace, { id: crypto.randomUUID(), treeId: id })
      commit({ trees, workspace })
      if (replacedTree) await deleteTree(replacedTree.id)
    },
    [addTree, commit, deleteTree],
  )

  const forkView = useCallback(
    async (tabId: string, graph: FamilyGraph) => {
      const tab = latest.current.workspace.tabs.find((t) => t.id === tabId)
      if (!tab?.viewRootId) return
      const id = await addTree(graph, false)
      const { trees, workspace } = latest.current
      commit({
        trees: linkTrees(trees, tab.treeId, tab.viewRootId, id),
        workspace: updateTab(workspace, tabId, { treeId: id, viewRootId: undefined, editChoice: undefined }),
      })
    },
    [addTree, commit],
  )

  const workspace = data.workspace
  const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? null
  const states = Object.values(saveStates)
  const saveState: SaveState = states.includes('failed')
    ? 'failed'
    : states.includes('saving')
      ? 'saving'
      : 'saved'

  return {
    ...data,
    loading,
    activeTab,
    saveState,
    savedAt,
    persisted,
    undoable,
    selectTab: useCallback(
      (tabId: string) => commit({ workspace: { ...latest.current.workspace, activeTabId: tabId } }),
      [commit],
    ),
    closeTab: useCallback(
      (tabId: string) => commit({ workspace: removeTab(latest.current.workspace, tabId) }),
      [commit],
    ),
    showTree: useCallback(
      (treeId: TreeId) => commit({ workspace: showTreeIn(latest.current.workspace, treeId) }),
      [commit],
    ),
    openView: useCallback(
      (treeId: TreeId, personId: PersonId) =>
        commit({ workspace: openViewIn(latest.current.workspace, treeId, personId) }),
      [commit],
    ),
    createTree,
    setGraph,
    undo: useCallback((treeId: TreeId) => step(treeId, undoIn), [step]),
    redo: useCallback((treeId: TreeId) => step(treeId, redoIn), [step]),
    restoreSnapshot,
    ignoreIssue: useCallback(
      (treeId: TreeId, issueId: string, ignored: boolean) =>
        commit({ trees: ignoreIssue(latest.current.trees, treeId, issueId, ignored) }),
      [commit],
    ),
    replaceGraph,
    forkView,
    shareView: useCallback(
      (tabId: string) => commit({ workspace: updateTab(latest.current.workspace, tabId, { editChoice: 'shared' }) }),
      [commit],
    ),
    setTabView: useCallback(
      (tabId: string, view: TreeView) =>
        commit({ workspace: updateTab(latest.current.workspace, tabId, { view: view === 'tree' ? undefined : view }) }),
      [commit],
    ),
    deleteTree,
  }
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

/**
 * This device's display settings; null while loading. Changes are saved
 * straight away and picked up by other open tabs.
 */
export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      db.loadSettings().then(
        (loaded) => !cancelled && setSettings(loaded),
        // If storage is unavailable, carry on with the defaults.
        () => !cancelled && setSettings((current) => current ?? DEFAULT_SETTINGS),
      )
    void load()
    const stopListening = onTabMessage((message) => {
      if (message.type === 'settings') void load()
    })
    return () => {
      cancelled = true
      stopListening()
    }
  }, [])

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...(settings ?? DEFAULT_SETTINGS), ...patch }
      setSettings(next)
      db.saveSettings(next).then(
        () => notifyTabs({ type: 'settings' }),
        () => {},
      )
    },
    [settings],
  )

  return [settings, update]
}

/** A backup older than this is worth a reminder. */
export const BACKUP_REMINDER_MS = 30 * 24 * 60 * 60 * 1000

export interface LastBackup {
  /** When a backup file was last exported on this device; null if never. */
  at: number | null
  /** Whether that's long enough ago, or never, to remind the person to export one. */
  isOld: boolean
}

/** The last backup exported on this device; undefined while loading. */
export function useLastBackup(): LastBackup | undefined {
  const [backup, setBackup] = useState<LastBackup | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    const set = (at: number | null) => setBackup({ at, isOld: at === null || Date.now() - at > BACKUP_REMINDER_MS })
    db.loadLastBackupAt().then(
      (loaded) => !cancelled && set(loaded),
      () => !cancelled && set(null),
    )
    const stop = onBackupExported(set)
    return () => {
      cancelled = true
      stop()
    }
  }, [])
  return backup
}
