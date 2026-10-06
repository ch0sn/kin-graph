import type { FamilyGraph, PersonId } from '../model'
import type { StartTabs } from './settings'

export type TreeId = string

/** What KinGraph knows about a saved tree, apart from the tree itself. */
export interface TreeMeta {
  id: TreeId
  /** The person's own tree, marked with a star; at most one. */
  own?: boolean
  createdAt: number
  /**
   * People in this tree who have a tree of their own on this device, so
   * "View as …" opens that tree instead of re-rooting this one.
   */
  links?: Record<PersonId, TreeId>
}

/**
 * An open tab: a tree, or with `viewRootId`, a view of a tree from another
 * person's point of view. A view shows the same people; edits change the tree.
 */
export interface Tab {
  id: string
  treeId: TreeId
  viewRootId?: PersonId
  /** The person chose to edit the viewed tree itself rather than make a tree of its own. */
  editChoice?: 'shared'
}

export interface Workspace {
  tabs: Tab[]
  activeTabId: string | null
}

export const EMPTY_WORKSPACE: Workspace = { tabs: [], activeTabId: null }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((v) => typeof v === 'string')

/** Reads the stored list of trees, dropping anything that isn't one. */
export function parseTreeMetas(raw: unknown): TreeMeta[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): TreeMeta[] => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    return [
      {
        id: item.id,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
        ...(item.own === true && { own: true }),
        ...(isStringRecord(item.links) && { links: item.links }),
      },
    ]
  })
}

/** Reads the stored tabs; null if there are none or they can't be read. */
export function parseWorkspace(raw: unknown): Workspace | null {
  if (!isRecord(raw) || !Array.isArray(raw.tabs)) return null
  const tabs = raw.tabs.flatMap((item): Tab[] => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.treeId !== 'string') return []
    return [
      {
        id: item.id,
        treeId: item.treeId,
        ...(typeof item.viewRootId === 'string' && { viewRootId: item.viewRootId }),
        ...(item.editChoice === 'shared' && { editChoice: 'shared' as const }),
      },
    ]
  })
  const activeTabId =
    typeof raw.activeTabId === 'string' && tabs.some((tab) => tab.id === raw.activeTabId)
      ? raw.activeTabId
      : (tabs[0]?.id ?? null)
  return { tabs, activeTabId }
}

export const newTabId = () => crypto.randomUUID()

/** The person's own tree, or failing that the oldest one. */
export function ownTree(trees: readonly TreeMeta[]): TreeMeta | undefined {
  return trees.find((tree) => tree.own) ?? [...trees].sort((a, b) => a.createdAt - b.createdAt)[0]
}

/** The tabs to open when KinGraph starts, from the ones saved last time. */
export function startingWorkspace(
  saved: Workspace | null,
  trees: readonly TreeMeta[],
  onStart: StartTabs,
): Workspace {
  const exists = new Set(trees.map((tree) => tree.id))
  const tabs = onStart === 'last-tabs' ? (saved?.tabs ?? []).filter((tab) => exists.has(tab.treeId)) : []
  if (tabs.length > 0) {
    const activeTabId = tabs.some((tab) => tab.id === saved?.activeTabId) ? saved!.activeTabId : tabs[0].id
    return { tabs, activeTabId }
  }
  const own = ownTree(trees)
  if (!own) return EMPTY_WORKSPACE
  const tab = { id: newTabId(), treeId: own.id }
  return { tabs: [tab], activeTabId: tab.id }
}

/** Adds a tab after the active one and switches to it. */
export function addTab(workspace: Workspace, tab: Tab): Workspace {
  const at = workspace.tabs.findIndex((t) => t.id === workspace.activeTabId)
  const tabs = [...workspace.tabs]
  tabs.splice(at === -1 ? tabs.length : at + 1, 0, tab)
  return { tabs, activeTabId: tab.id }
}

/** Switches to the tab showing `treeId` itself, opening one if there isn't one. */
export function showTree(workspace: Workspace, treeId: TreeId): Workspace {
  const open = workspace.tabs.find((tab) => tab.treeId === treeId && !tab.viewRootId)
  return open ? { ...workspace, activeTabId: open.id } : addTab(workspace, { id: newTabId(), treeId })
}

/** Closes a tab, switching to its neighbour if it was the active one. */
export function removeTab(workspace: Workspace, tabId: string): Workspace {
  const at = workspace.tabs.findIndex((tab) => tab.id === tabId)
  if (at === -1) return workspace
  const tabs = workspace.tabs.filter((tab) => tab.id !== tabId)
  if (workspace.activeTabId !== tabId) return { ...workspace, tabs }
  return { tabs, activeTabId: (tabs[at] ?? tabs[at - 1])?.id ?? null }
}

export function updateTab(workspace: Workspace, tabId: string, patch: Partial<Tab>): Workspace {
  return { ...workspace, tabs: workspace.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab)) }
}

/** Shows a tree from `personId`'s point of view, as a view with them as the root. */
export function openView(workspace: Workspace, treeId: TreeId, personId: PersonId): Workspace {
  const open = workspace.tabs.find((tab) => tab.treeId === treeId && tab.viewRootId === personId)
  if (open) return { ...workspace, activeTabId: open.id }
  return addTab(workspace, { id: newTabId(), treeId, viewRootId: personId })
}

/** `personId`'s own tree, if one is linked from tree `from` and still saved. */
export function linkedTree(trees: readonly TreeMeta[], from: TreeId, personId: PersonId): TreeId | null {
  const linked = trees.find((tree) => tree.id === from)?.links?.[personId]
  return linked && trees.some((tree) => tree.id === linked) ? linked : null
}

/** Records that `personId` in tree `from` has their own tree, `to`. */
export function linkTrees(trees: TreeMeta[], from: TreeId, personId: PersonId, to: TreeId): TreeMeta[] {
  return trees.map((tree) =>
    tree.id === from ? { ...tree, links: { ...tree.links, [personId]: to } } : tree,
  )
}

/** Forgets a tree, and every link to it. */
export function dropTree(trees: TreeMeta[], id: TreeId): TreeMeta[] {
  return trees
    .filter((tree) => tree.id !== id)
    .map((tree) => {
      if (!tree.links || !Object.values(tree.links).includes(id)) return tree
      const links = Object.fromEntries(Object.entries(tree.links).filter(([, to]) => to !== id))
      return { ...tree, links }
    })
}

/** The tree as a view shows it: the same people, seen from the view's root. */
export function viewGraph(graph: FamilyGraph, tab: Tab): FamilyGraph {
  return tab.viewRootId && tab.viewRootId !== graph.managerId
    ? { ...graph, managerId: tab.viewRootId }
    : graph
}

/** Turns an edit made in a view back into the tree, whose root stays its manager. */
export function unviewGraph(edited: FamilyGraph, original: FamilyGraph): FamilyGraph {
  return edited.managerId === original.managerId ? edited : { ...edited, managerId: original.managerId }
}
