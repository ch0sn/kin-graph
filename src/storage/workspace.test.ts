import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  addTab,
  dropTree,
  linkedTree,
  linkTrees,
  openView,
  parseTreeMetas,
  parseWorkspace,
  removeTab,
  showTree,
  startingWorkspace,
  unviewGraph,
  viewGraph,
  type TreeMeta,
  type Workspace,
} from './workspace'

const trees: TreeMeta[] = [
  { id: 'mine', own: true, createdAt: 2 },
  { id: 'dad', createdAt: 1 },
]
const two: Workspace = {
  tabs: [
    { id: 't1', treeId: 'mine' },
    { id: 't2', treeId: 'dad' },
  ],
  activeTabId: 't1',
}

describe('startingWorkspace', () => {
  it('reopens the last tabs, leaving out deleted trees', () => {
    const saved = { tabs: [...two.tabs, { id: 't3', treeId: 'gone' }], activeTabId: 't2' }
    expect(startingWorkspace(saved, trees, 'last-tabs')).toEqual({ tabs: two.tabs, activeTabId: 't2' })
  })

  it('opens only your own tree when asked to', () => {
    const { tabs } = startingWorkspace(two, trees, 'own-tree')
    expect(tabs.map((tab) => tab.treeId)).toEqual(['mine'])
  })

  it('falls back to your own tree, or nothing when there are no trees', () => {
    expect(startingWorkspace(null, trees, 'last-tabs').tabs.map((tab) => tab.treeId)).toEqual(['mine'])
    expect(startingWorkspace(null, [], 'last-tabs')).toEqual({ tabs: [], activeTabId: null })
  })
})

describe('tabs', () => {
  it('adds a tab after the active one and switches to it', () => {
    const next = addTab(two, { id: 'new', treeId: 'x' })
    expect(next.tabs.map((tab) => tab.id)).toEqual(['t1', 'new', 't2'])
    expect(next.activeTabId).toBe('new')
  })

  it('switches to a neighbour when the active tab closes', () => {
    expect(removeTab(two, 't1')).toEqual({ tabs: [two.tabs[1]], activeTabId: 't2' })
    expect(removeTab({ ...two, activeTabId: 't2' }, 't2').activeTabId).toBe('t1')
    expect(removeTab({ tabs: [two.tabs[0]], activeTabId: 't1' }, 't1')).toEqual({ tabs: [], activeTabId: null })
  })

  it('shows an open tree rather than opening it twice', () => {
    expect(showTree(two, 'dad')).toEqual({ ...two, activeTabId: 't2' })
    expect(showTree({ tabs: [two.tabs[0]], activeTabId: 't1' }, 'dad').tabs).toHaveLength(2)
  })
})

describe('openView', () => {
  it('opens a view of the tree with the person as root', () => {
    const next = openView(two, 'mine', 'peter')
    expect(next.tabs[1]).toMatchObject({ treeId: 'mine', viewRootId: 'peter' })
    expect(next.activeTabId).toBe(next.tabs[1].id)
    // A second time, the same view.
    expect(openView(next, 'mine', 'peter')).toEqual(next)
  })
})

describe('linked trees', () => {
  it('finds the person’s own tree while it’s saved', () => {
    const linked = linkTrees(trees, 'mine', 'peter', 'dad')
    expect(linkedTree(linked, 'mine', 'peter')).toBe('dad')
    expect(linkedTree(linked, 'mine', 'paul')).toBeNull()
  })

  it('forgets the link once the tree is deleted', () => {
    const dropped = dropTree(linkTrees(trees, 'mine', 'peter', 'dad'), 'dad')
    expect(dropped[0].links).toEqual({})
    expect(linkedTree(dropped, 'mine', 'peter')).toBeNull()
  })
})

describe('views', () => {
  it('re-roots the tree and puts the root back after an edit', () => {
    const graph = sampleFamily()
    const other = Object.keys(graph.people).find((id) => id !== graph.managerId)!
    const viewed = viewGraph(graph, { id: 't', treeId: 'mine', viewRootId: other })
    expect(viewed.managerId).toBe(other)
    expect(viewed.people).toBe(graph.people)
    expect(unviewGraph(viewed, graph).managerId).toBe(graph.managerId)
  })
})

describe('parsing', () => {
  it('drops what isn’t a tree or tab', () => {
    expect(parseTreeMetas([{ id: 'a', createdAt: 1, own: 'yes', links: { p: 3 } }, 7, { own: true }])).toEqual([
      { id: 'a', createdAt: 1 },
    ])
    expect(parseWorkspace({ tabs: [{ id: 't', treeId: 'a', editChoice: 'x' }, {}], activeTabId: 'zz' })).toEqual({
      tabs: [{ id: 't', treeId: 'a' }],
      activeTabId: 't',
    })
    expect(parseWorkspace('nope')).toBeNull()
  })
})
