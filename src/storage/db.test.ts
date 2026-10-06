import 'fake-indexeddb/auto'
import { clear, createStore, get, set } from 'idb-keyval'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  deleteTree,
  isOnboarded,
  loadSettings,
  loadTree,
  loadTrees,
  loadWorkspace,
  saveSettings,
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
