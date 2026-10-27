import 'fake-indexeddb/auto'
import { clear, createStore, del, get, set } from 'idb-keyval'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  deleteTree,
  isOnboarded,
  loadLastBackupAt,
  loadSettings,
  loadSnapshots,
  loadTree,
  loadTrees,
  loadWorkspace,
  saveLastBackupAt,
  saveSettings,
  saveSnapshot,
  saveTree,
  saveTrees,
  saveWorkspace,
  setOnboarded,
} from './db'
import { DEFAULT_SETTINGS } from './settings'

const store = createStore('kingraph', 'state')

beforeEach(async () => {
  await clear(store)
  await setOnboarded(false)
})

describe('tree storage', () => {
  it('is empty before anything is saved', async () => {
    expect(await loadTrees()).toEqual([])
    expect(await loadTree('a')).toEqual({ status: 'empty' })
  })

  it('keeps each tree under its own id', async () => {
    const graph = sampleFamily()
    await saveTree('a', graph)
    expect(await loadTree('a')).toEqual({ status: 'ready', graph, savedAt: expect.any(Number) })
    expect(await loadTree('b')).toEqual({ status: 'empty' })
  })

  it('deletes one tree', async () => {
    await saveTree('a', sampleFamily())
    await saveTree('b', sampleFamily())
    await deleteTree('a')
    expect(await loadTree('a')).toEqual({ status: 'empty' })
    expect((await loadTree('b')).status).toBe('ready')
  })

  it('reports damaged data instead of throwing', async () => {
    await set('tree:a', { format: 'kingraph-tree', version: 1, graph: {} }, store)
    expect(await loadTree('a')).toEqual({ status: 'damaged', message: expect.stringMatching(/damaged/) })
  })

  it('remembers the list of trees', async () => {
    const trees = [{ id: 'a', own: true, createdAt: 1, links: { p1: 'b' } }, { id: 'b', createdAt: 2 }]
    await saveTrees(trees)
    expect(await loadTrees()).toEqual(trees)
  })

  it('moves a tree saved before there could be several into the list, as your own', async () => {
    const graph = sampleFamily()
    await set('tree', { format: 'kingraph-tree', version: 4, savedAt: '', graph }, store)
    const [meta, ...rest] = await loadTrees()
    expect(rest).toEqual([])
    expect(meta.own).toBe(true)
    expect(await loadTree(meta.id)).toEqual({ status: 'ready', graph })
    expect(await get('tree', store)).toBeUndefined()
    // Only once.
    expect(await loadTrees()).toEqual([meta])
  })
})

describe('workspace', () => {
  it('is null until saved, then remembered', async () => {
    expect(await loadWorkspace()).toBeNull()
    const workspace = { tabs: [{ id: 't1', treeId: 'a' }, { id: 't2', treeId: 'a', viewRootId: 'p1' }], activeTabId: 't2' }
    await saveWorkspace(workspace)
    expect(await loadWorkspace()).toEqual(workspace)
  })
})

describe('settings', () => {
  it('default until saved, then remembered', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    const settings = {
      language: 'de',
      colorMode: 'dark',
      theme: 'blueprint',
      colorVision: 'tritanopia',
      siblingOrder: 'girls-first',
      nameOrder: 'family-first',
      highlightGender: true,
      closeTab: 'ask',
      newTreeIn: 'replace',
      onStart: 'own-tree',
      fanGenerations: 5,
    } as const
    await saveSettings(settings)
    expect(await loadSettings()).toEqual(settings)
  })

  it('falls back to defaults for unknown values', async () => {
    await set(
      'settings',
      { language: 'klingon', colorMode: 'sepia', theme: 'neon', siblingOrder: 'tallest-first', highlightGender: 'yes', extra: 1 },
      store,
    )
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('onboarding flag', () => {
  it('is remembered', async () => {
    expect(await isOnboarded()).toBe(false)
    await setOnboarded(true)
    expect(await isOnboarded()).toBe(true)
  })
})

describe('snapshots', () => {
  it('are kept per tree, newest first, without repeating an unchanged tree', async () => {
    const graph = sampleFamily()
    expect(await saveSnapshot('a', graph, 'opened', 1000)).toBe(true)
    expect(await saveSnapshot('a', graph, 'autosave', 2000)).toBe(false)
    const edited = { ...graph, managerId: Object.keys(graph.people)[1] }
    expect(await saveSnapshot('a', edited, 'beforeRemove', 3000)).toBe(true)
    const snapshots = await loadSnapshots('a')
    expect(snapshots.map((s) => [s.takenAt, s.reason])).toEqual([
      [3000, 'beforeRemove'],
      [1000, 'opened'],
    ])
    expect(snapshots[1].graph).toEqual(graph)
    expect(await loadSnapshots('b')).toEqual([])
  })

  it('go when their tree is deleted', async () => {
    await saveTree('a', sampleFamily())
    await saveSnapshot('a', sampleFamily(), 'opened')
    await deleteTree('a')
    expect(await loadSnapshots('a')).toEqual([])
  })

  it('leave out any that are damaged', async () => {
    await set('snapshots:a', [{ id: 'x', takenAt: 1, reason: 'opened', document: { graph: {} } }, 'junk'], store)
    expect(await loadSnapshots('a')).toEqual([])
  })
})

describe('last backup', () => {
  it('is null until one is exported', async () => {
    await del('lastBackupAt', store)
    expect(await loadLastBackupAt()).toBeNull()
    await saveLastBackupAt(42)
    expect(await loadLastBackupAt()).toBe(42)
  })
})
