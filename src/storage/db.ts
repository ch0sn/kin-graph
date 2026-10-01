import { createStore, del, get, set } from 'idb-keyval'
import type { FamilyGraph } from '../model'
import { parseTreeDocument, toDocument, TreeFileError } from './treeDocument'

/** Everything KinGraph keeps lives in this one IndexedDB store on the device. */
const store = createStore('kingraph', 'state')

const TREE_KEY = 'tree'
const ONBOARDED_KEY = 'onboarded'

export type LoadedTree =
  | { status: 'empty' }
  | { status: 'ready'; graph: FamilyGraph }
  /** Something is saved but it isn't a valid tree; it's left untouched. */
  | { status: 'damaged'; message: string }

export async function loadTree(): Promise<LoadedTree> {
  const saved: unknown = await get(TREE_KEY, store)
  if (saved === undefined) return { status: 'empty' }
  try {
    return { status: 'ready', graph: parseTreeDocument(saved) }
  } catch (error) {
    if (!(error instanceof TreeFileError)) throw error
    return { status: 'damaged', message: error.message }
  }
}

export function saveTree(graph: FamilyGraph): Promise<void> {
  return set(TREE_KEY, toDocument(graph), store)
}

export function clearTree(): Promise<void> {
  return del(TREE_KEY, store)
}

export async function isOnboarded(): Promise<boolean> {
  return (await get(ONBOARDED_KEY, store)) === true
}

export function setOnboarded(done: boolean): Promise<void> {
  return set(ONBOARDED_KEY, done, store)
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
