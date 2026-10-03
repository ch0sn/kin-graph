import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { beforeEach, describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  clearTree,
  isOnboarded,
  loadSettings,
  loadTree,
  saveSettings,
  saveTree,
  setOnboarded,
} from './db'
import { DEFAULT_SETTINGS } from './settings'

beforeEach(async () => {
  await clearTree()
  await setOnboarded(false)
})

describe('tree storage', () => {
  it('is empty before anything is saved', async () => {
    expect(await loadTree()).toEqual({ status: 'empty' })
  })

  it('loads what was saved', async () => {
    const graph = sampleFamily()
    await saveTree(graph)
    expect(await loadTree()).toEqual({ status: 'ready', graph })
  })

  it('clears the saved tree', async () => {
    await saveTree(sampleFamily())
    await clearTree()
    expect(await loadTree()).toEqual({ status: 'empty' })
  })

  it('reports damaged data instead of throwing', async () => {
    await set('tree', { format: 'kingraph-tree', version: 1, graph: {} }, createStore('kingraph', 'state'))
    expect(await loadTree()).toEqual({ status: 'damaged', message: expect.stringMatching(/damaged/) })
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
    } as const
    await saveSettings(settings)
    expect(await loadSettings()).toEqual(settings)
  })

  it('falls back to defaults for unknown values', async () => {
    await set(
      'settings',
      { language: 'klingon', colorMode: 'sepia', theme: 'neon', siblingOrder: 'tallest-first', highlightGender: 'yes', extra: 1 },
      createStore('kingraph', 'state'),
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
