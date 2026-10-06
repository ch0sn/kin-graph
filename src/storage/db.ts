import { createStore, del, get, set } from 'idb-keyval'
import type { FamilyGraph } from '../model'
import { parseSettings, type Settings } from './settings'
import { parseTreeMetas, parseWorkspace, type TreeId, type TreeMeta, type Workspace } from './workspace'
import { parseTreeDocument, toDocument, TreeFileError } from './treeDocument'

/** Everything KinGraph keeps lives in this one IndexedDB store on the device. */
const store = createStore('kingraph', 'state')

/** Where the single tree was kept before there could be several; moved on first load. */
const LEGACY_TREE_KEY = 'tree'
const TREES_KEY = 'trees'
const WORKSPACE_KEY = 'workspace'
const ONBOARDED_KEY = 'onboarded'
const SETTINGS_KEY = 'settings'

const treeKey = (id: TreeId) => `tree:${id}`

export type LoadedTree =
  | { status: 'empty' }
  /** `savedAt` is when it was last saved, in ms, if known. */
  | { status: 'ready'; graph: FamilyGraph; savedAt?: number }
  /** Something is saved but it isn't a valid tree; it's left untouched. */
  | { status: 'damaged'; message: string }

/**
 * The trees saved on this device. A tree saved by an older KinGraph, when
 * there could only be one, becomes the person's own tree.
 */
export async function loadTrees(): Promise<TreeMeta[]> {
  const saved = await get<unknown>(TREES_KEY, store)
  if (saved !== undefined) return parseTreeMetas(saved)
  const legacy: unknown = await get(LEGACY_TREE_KEY, store)
  if (legacy === undefined) return []
  const meta: TreeMeta = { id: crypto.randomUUID(), own: true, createdAt: Date.now() }
  // Copy before deleting, so an interruption can't lose the tree.
  await set(treeKey(meta.id), legacy, store)
  await set(TREES_KEY, [meta], store)
  await del(LEGACY_TREE_KEY, store)
  return [meta]
}

export function saveTrees(trees: TreeMeta[]): Promise<void> {
  return set(TREES_KEY, trees, store)
}

export async function loadTree(id: TreeId): Promise<LoadedTree> {
  const saved: unknown = await get(treeKey(id), store)
  if (saved === undefined) return { status: 'empty' }
  try {
    const graph = parseTreeDocument(saved)
    const savedAt = Date.parse((saved as { savedAt?: string }).savedAt ?? '')
    return { status: 'ready', graph, ...(Number.isFinite(savedAt) && { savedAt }) }
  } catch (error) {
    if (!(error instanceof TreeFileError)) throw error
    return { status: 'damaged', message: error.message }
  }
}

export function saveTree(id: TreeId, graph: FamilyGraph): Promise<void> {
  return set(treeKey(id), toDocument(graph), store)
}

export function deleteTree(id: TreeId): Promise<void> {
  return del(treeKey(id), store)
}

/** The tabs that were open, or null if none were saved yet. */
export async function loadWorkspace(): Promise<Workspace | null> {
  return parseWorkspace(await get<unknown>(WORKSPACE_KEY, store))
}

export function saveWorkspace(workspace: Workspace): Promise<void> {
  return set(WORKSPACE_KEY, workspace, store)
}

export async function isOnboarded(): Promise<boolean> {
  return (await get(ONBOARDED_KEY, store)) === true
}

export function setOnboarded(done: boolean): Promise<void> {
  return set(ONBOARDED_KEY, done, store)
}

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await get(SETTINGS_KEY, store))
}

export function saveSettings(settings: Settings): Promise<void> {
  return set(SETTINGS_KEY, settings, store)
}

/**
 * Asks the browser not to clear KinGraph's data when space runs low or the
 * site goes unused. Resolves to whether storage is persistent.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
