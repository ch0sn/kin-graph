import { createStore, del, get, set, update } from 'idb-keyval'
import type { FamilyGraph } from '../model'
import { parseSettings, type Settings } from './settings'
import { parseTreeMetas, parseWorkspace, type TreeId, type TreeMeta, type Workspace } from './workspace'
import { retain, SNAPSHOT_REASONS, type Snapshot, type SnapshotReason } from './snapshots'
import { parseTreeDocument, toDocument, TreeFileError, type TreeDocument } from './treeDocument'

/** Everything KinGraph keeps lives in this one IndexedDB store on the device. */
const store = createStore('kingraph', 'state')

/** Where the single tree was kept before there could be several; moved on first load. */
const LEGACY_TREE_KEY = 'tree'
const TREES_KEY = 'trees'
const WORKSPACE_KEY = 'workspace'
const ONBOARDED_KEY = 'onboarded'
const SETTINGS_KEY = 'settings'
const LAST_BACKUP_KEY = 'lastBackupAt'

const treeKey = (id: TreeId) => `tree:${id}`
const snapshotsKey = (id: TreeId) => `snapshots:${id}`

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

/** Deletes a tree and its snapshots. */
export async function deleteTree(id: TreeId): Promise<void> {
  await del(treeKey(id), store)
  await del(snapshotsKey(id), store)
}

/** A snapshot as stored: the tree in the same format as the tree itself. */
interface StoredSnapshot {
  id: string
  takenAt: number
  reason: SnapshotReason
  document: TreeDocument
}

function storedSnapshots(raw: unknown): StoredSnapshot[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is StoredSnapshot =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.takenAt === 'number' &&
      SNAPSHOT_REASONS.includes(item.reason) &&
      typeof item.document === 'object',
  )
}

/** A tree's snapshots, newest first. Any that can't be read are left out. */
export async function loadSnapshots(id: TreeId): Promise<Snapshot[]> {
  return storedSnapshots(await get(snapshotsKey(id), store)).flatMap((stored): Snapshot[] => {
    try {
      const graph = parseTreeDocument(stored.document)
      return [{ id: stored.id, takenAt: stored.takenAt, reason: stored.reason, graph }]
    } catch {
      return []
    }
  })
}

/**
 * Keeps a copy of a tree, unless it's just like the latest one, and lets the
 * oldest go as `retain` says. Resolves to whether a copy was added.
 */
export async function saveSnapshot(
  id: TreeId,
  graph: FamilyGraph,
  reason: SnapshotReason,
  now = Date.now(),
): Promise<boolean> {
  let added = false
  await update(
    snapshotsKey(id),
    (raw: unknown) => {
      const snapshots = storedSnapshots(raw)
      const latest = snapshots.reduce<StoredSnapshot | undefined>(
        (newest, s) => (!newest || s.takenAt > newest.takenAt ? s : newest),
        undefined,
      )
      if (latest && JSON.stringify(latest.document.graph) === JSON.stringify(graph)) return snapshots
      added = true
      const document = toDocument(graph, new Date(now))
      return retain([...snapshots, { id: crypto.randomUUID(), takenAt: now, reason, document }])
    },
    store,
  )
  return added
}

/** When a backup file was last exported on this device, in ms; null if never. */
export async function loadLastBackupAt(): Promise<number | null> {
  const at = await get<unknown>(LAST_BACKUP_KEY, store)
  return typeof at === 'number' ? at : null
}

export function saveLastBackupAt(at: number): Promise<void> {
  return set(LAST_BACKUP_KEY, at, store)
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
