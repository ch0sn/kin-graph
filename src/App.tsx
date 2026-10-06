import { motion, MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'
import { AppMenu, SaveIndicator } from './app/AppMenu'
import { HeaderActions } from './app/HeaderActions'
import { ReplaceTreeConfirm } from './app/ReplaceTreeConfirm'
import { SettingsDialog } from './app/SettingsDialog'
import { TabBar, type SavedTreeItem, type TabItem } from './app/TabBar'
import { useAppearance } from './app/theme'
import { DEFAULT_LANGUAGE, LanguageProvider, useT } from './i18n'
import {
  fullName,
  GraphError,
  peopleCount,
  setPreferredNameOrder,
  type FamilyGraph,
  type PersonId,
} from './model'
import { DamagedTree } from './onboarding/DamagedTree'
import { Onboarding } from './onboarding/Onboarding'
import { Welcome } from './onboarding/Welcome'
import { PersonSheet, type Perspectives } from './sheet/PersonSheet'
import { downloadBackup } from './storage/backup'
import type { Settings } from './storage/settings'
import { useBackupPicker } from './storage/useBackupPicker'
import {
  useOnboarded,
  useSettings,
  useStoredTrees,
  type StoredTrees,
} from './storage/useStoredTree'
import { linkedTree, unviewGraph, viewGraph, type Tab, type TreeId } from './storage/workspace'
import { themeInfo } from './theme/themes'
import { FamilyTree } from './tree/FamilyTree'
import { ConfirmDialog } from './ui/ConfirmDialog'

function App() {
  const [onboarded, setOnboarded] = useOnboarded()
  const [settings, updateSettings] = useSettings()
  const stored = useStoredTrees(settings?.onStart ?? null)
  useAppearance(settings?.colorMode ?? null, settings?.theme ?? null, settings?.colorVision ?? null)
  const [replayingIntro, setReplayingIntro] = useState(false)
  // Assigned during render, like the language, so names are written the same everywhere.
  setPreferredNameOrder(settings?.nameOrder ?? 'given-first')

  let screen
  if (stored.loading || onboarded === null || settings === null) {
    screen = null
  } else if (!onboarded || replayingIntro) {
    screen = (
      <Onboarding
        onDone={() => {
          setOnboarded(true)
          setReplayingIntro(false)
        }}
      />
    )
  } else if (stored.trees.length === 0) {
    screen = <Welcome onStart={(graph) => void stored.createTree(graph)} />
  } else {
    screen = (
      <WorkspaceScreen
        stored={stored}
        settings={settings}
        onSettingsChange={updateSettings}
        onShowIntro={() => setReplayingIntro(true)}
      />
    )
  }

  return (
    <LanguageProvider language={settings?.language ?? DEFAULT_LANGUAGE}>
      <MotionConfig reducedMotion="user">{screen}</MotionConfig>
    </LanguageProvider>
  )
}

/** A question about a tab's tree, waiting for an answer. */
type Pending =
  /** Closing a tab, when settings say to ask whether to keep the tree. */
  | { kind: 'close'; tabId: string; treeId: TreeId }
  | { kind: 'delete'; treeId: TreeId }
  /**
   * An edit made in a view: should it start the root person's own tree?
   * `then` runs once the edit is applied either way, not when it's cancelled.
   */
  | { kind: 'fork'; tabId: string; graph: FamilyGraph; then?: () => void }
  /** "View as …": just a view, or a tree of the person's own? */
  | { kind: 'viewAs'; treeId: TreeId; personId: PersonId }
  /** Making a tree of someone who already has one: which should be theirs? */
  | { kind: 'chooseTree'; treeId: TreeId; personId: PersonId; existing: TreeId }

function WorkspaceScreen({
  stored,
  settings,
  onSettingsChange,
  onShowIntro,
}: {
  stored: StoredTrees
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  onShowIntro: () => void
}) {
  const { t, language } = useT()
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Starting a new tree, possibly in place of a tab's tree. */
  const [creating, setCreating] = useState<{ replaceTabId?: string } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [exported, setExported] = useState(false)
  /** Where the tree puts its view controls: hanging from the tab bar's right end. */
  const [viewControls, setViewControls] = useState<HTMLElement | null>(null)
  /** A new tree about to replace the active tab's tree, once the person confirms. */
  const [replacing, setReplacing] = useState<{ tabId: string; run: (tabId: string) => void } | null>(null)
  const importPicker = useBackupPicker((graph) =>
    inPlaceOrNewTab((replaceTabId) => void stored.createTree(graph, { replaceTabId })),
  )

  const { graphs, trees, activeTab } = stored
  const graphOf = (treeId: TreeId) => {
    const state = graphs[treeId]
    return state?.status === 'ready' ? state.graph : null
  }
  const treeLabel = (treeId: TreeId) => {
    const graph = graphOf(treeId)
    return graph ? fullName(graph.people[graph.managerId]) : t('tabs.damaged')
  }
  const treeName = (treeId: TreeId) => {
    const graph = graphOf(treeId)
    return graph ? t('newTree.treeName', { name: fullName(graph.people[graph.managerId]) }) : t('tabs.damaged')
  }

  const tabItems: TabItem[] = stored.workspace.tabs.map((tab) => {
    const graph = graphOf(tab.treeId)
    const root = tab.viewRootId && graph?.people[tab.viewRootId]
    if (root) {
      const name = fullName(root)
      return { id: tab.id, kind: 'view', label: name, title: t('tabs.viewOf', { tree: treeName(tab.treeId), name }) }
    }
    const own = trees.find((tree) => tree.id === tab.treeId)?.own
    return { id: tab.id, kind: own ? 'own' : 'tree', label: treeLabel(tab.treeId) }
  })

  const openTreeIds = new Set(stored.workspace.tabs.filter((tab) => !tab.viewRootId).map((tab) => tab.treeId))
  const closedTrees: SavedTreeItem[] = trees
    .filter((tree) => !openTreeIds.has(tree.id))
    .map((tree) => ({ id: tree.id, label: treeLabel(tree.id), own: Boolean(tree.own) }))

  const activeGraph = activeTab ? graphOf(activeTab.treeId) : null
  const shownGraph = !creating && activeTab && activeGraph ? viewGraph(activeGraph, activeTab) : null
  const replaces = settings.newTreeIn === 'replace' && Boolean(activeTab && !activeTab.viewRootId)

  const personName = (treeId: TreeId, personId: PersonId) => {
    const person = graphOf(treeId)?.people[personId]
    return person ? fullName(person) : ''
  }
  const savedTime = (treeId: TreeId) => {
    const at = stored.savedAt[treeId]
    return at
      ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(at)
      : t('choose.unknownTime')
  }

  /** Saves the tree as seen from `personId`'s side as their own tree, linked to them. */
  const makeTreeOf = (treeId: TreeId, personId: PersonId) => {
    const tree = graphOf(treeId)
    if (tree) void stored.createTree({ ...tree, managerId: personId }, { linkFrom: { treeId, personId } })
  }

  /**
   * Runs `run` for a new tree: in a new tab, or as settings say in place of
   * the active tab's tree, after confirming that tree's deletion.
   */
  function inPlaceOrNewTab(run: (replaceTabId?: string) => void) {
    if (replaces && activeTab) setReplacing({ tabId: activeTab.id, run })
    else run()
  }

  const closeTab = (tabId: string) => {
    const tab = stored.workspace.tabs.find((t) => t.id === tabId)
    if (!tab) return
    // A view is only a way of looking at a tree, so closing it never deletes anything.
    if (tab.viewRootId || settings.closeTab === 'keep') return stored.closeTab(tabId)
    setExported(false)
    setPending(
      settings.closeTab === 'ask'
        ? { kind: 'close', tabId, treeId: tab.treeId }
        : { kind: 'delete', treeId: tab.treeId },
    )
  }

  const startTree = (graph: FamilyGraph) => {
    const replaceTabId = creating?.replaceTabId
    setCreating(null)
    void stored.createTree(graph, { replaceTabId })
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/80 py-2 pr-2 pl-4 backdrop-blur"
        >
          <h1 className="font-serif text-xl tracking-tight">KinGraph</h1>
          <div className="flex items-center gap-1">
            <SaveIndicator state={stored.saveState} />
            <HeaderActions graph={shownGraph} />
            <AppMenu
              persisted={stored.persisted}
              onShowIntro={onShowIntro}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </motion.header>
        <TabBar
          tabs={tabItems}
          activeId={stored.workspace.activeTabId}
          creating={creating !== null}
          onCancelCreating={() => setCreating(null)}
          onSelect={(tabId) => {
            setCreating(null)
            stored.selectTab(tabId)
          }}
          onClose={closeTab}
          onNewTree={() => inPlaceOrNewTab((replaceTabId) => setCreating({ replaceTabId }))}
          onImport={importPicker.open}
          closedTrees={closedTrees}
          onOpenTree={(treeId) => {
            setCreating(null)
            stored.showTree(treeId)
          }}
          onDeleteTree={(treeId) => {
            setExported(false)
            setPending({ kind: 'delete', treeId })
          }}
          controlsRef={setViewControls}
        />
        {importPicker.input}
        <main className="relative min-h-0 flex-1">
          {creating ? (
            <Welcome onStart={startTree} onCancel={() => setCreating(null)} />
          ) : !activeTab ? (
            <Welcome
              onStart={startTree}
              savedTrees={closedTrees}
              onOpenSaved={stored.showTree}
            />
          ) : graphs[activeTab.treeId]?.status === 'damaged' ? (
            <DamagedTree
              key={activeTab.id}
              message={(graphs[activeTab.treeId] as { message: string }).message}
              onImport={(graph) => void stored.replaceGraph(activeTab.treeId, graph)}
              onStartOver={() => void stored.deleteTree(activeTab.treeId)}
            />
          ) : (
            shownGraph &&
            activeGraph && (
              <TreeTab
                key={activeTab.id}
                tab={activeTab}
                graph={shownGraph}
                tree={activeGraph}
                stored={stored}
                settings={settings}
                onSettingsChange={onSettingsChange}
                controlsSlot={viewControls}
                onFork={(graph, then) => setPending({ kind: 'fork', tabId: activeTab.id, graph, then })}
                onViewAs={(personId) => setPending({ kind: 'viewAs', treeId: activeTab.treeId, personId })}
                onDeleteTree={() => {
                  setExported(false)
                  setPending({ kind: 'delete', treeId: activeTab.treeId })
                }}
                treeName={treeName(activeTab.treeId)}
              />
            )
          )}
        </main>
      </div>
      <ReplaceTreeConfirm
        graph={replacing ? graphOf(stored.workspace.tabs.find((tab) => tab.id === replacing.tabId)?.treeId ?? '') : null}
        onConfirm={() => {
          replacing?.run(replacing.tabId)
          setReplacing(null)
        }}
        onCancel={() => setReplacing(null)}
      />
      <SettingsDialog
        open={settingsOpen}
        graph={shownGraph}
        onImportTree={(next) =>
          void stored.createTree(next, { replaceTabId: replaces ? activeTab?.id : undefined })
        }
        settings={settings}
        onChange={onSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        open={pending?.kind === 'close'}
        title={pending?.kind === 'close' ? t('tabs.closeTitle', { tree: treeName(pending.treeId) }) : ''}
        confirmLabel={t('tabs.keep')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={t('tabs.delete')}
        onSecondary={() => pending?.kind === 'close' && setPending({ kind: 'delete', treeId: pending.treeId })}
        onConfirm={() => {
          if (pending?.kind === 'close') stored.closeTab(pending.tabId)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {t('tabs.closeBody')}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={pending?.kind === 'delete' ? t('tabs.deleteTitle', { tree: treeName(pending.treeId) }) : ''}
        confirmLabel={t('tabs.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={
          pending?.kind === 'delete' && graphOf(pending.treeId)
            ? exported
              ? t('newTree.exported')
              : t('newTree.exportFirst')
            : undefined
        }
        onSecondary={() => {
          const graph = pending?.kind === 'delete' && graphOf(pending.treeId)
          if (graph) void downloadBackup(graph).then(() => setExported(true), () => {})
        }}
        tone="danger"
        onConfirm={() => {
          if (pending?.kind === 'delete') void stored.deleteTree(pending.treeId)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'delete' &&
          t('tabs.deleteBody', {
            tree: treeName(pending.treeId),
            people: graphOf(pending.treeId) ? peopleCount(graphOf(pending.treeId)!) : '?',
          })}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'fork'}
        title={
          pending?.kind === 'fork'
            ? t('fork.title', { name: fullName(pending.graph.people[pending.graph.managerId]) })
            : ''
        }
        confirmLabel={t('fork.own')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={activeTab ? t('fork.shared', { tree: treeName(activeTab.treeId) }) : undefined}
        onSecondary={() => {
          if (pending?.kind !== 'fork') return
          const tab = stored.workspace.tabs.find((t) => t.id === pending.tabId)
          const tree = tab && graphOf(tab.treeId)
          if (tab && tree) {
            stored.shareView(tab.id)
            stored.setGraph(tab.treeId, unviewGraph(pending.graph, tree))
            pending.then?.()
          }
          setPending(null)
        }}
        onConfirm={() => {
          if (pending?.kind === 'fork') {
            void stored.forkView(pending.tabId, pending.graph)
            pending.then?.()
          }
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'fork' &&
          activeTab &&
          t('fork.body', {
            tree: treeName(activeTab.treeId),
            name: fullName(pending.graph.people[pending.graph.managerId]),
          })}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'viewAs'}
        title={pending?.kind === 'viewAs' ? t('viewAs.title', { name: personName(pending.treeId, pending.personId) }) : ''}
        confirmLabel={t('viewAs.justView')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={
          pending?.kind === 'viewAs' ? t('viewAs.makeTree', { name: personName(pending.treeId, pending.personId) }) : undefined
        }
        onSecondary={() => {
          if (pending?.kind !== 'viewAs') return
          const existing = linkedTree(trees, pending.treeId, pending.personId)
          if (existing) setPending({ kind: 'chooseTree', treeId: pending.treeId, personId: pending.personId, existing })
          else {
            makeTreeOf(pending.treeId, pending.personId)
            setPending(null)
          }
        }}
        onConfirm={() => {
          if (pending?.kind === 'viewAs') stored.openView(pending.treeId, pending.personId)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'viewAs' &&
          t('viewAs.body', { name: personName(pending.treeId, pending.personId), tree: treeName(pending.treeId) })}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'chooseTree'}
        title={
          pending?.kind === 'chooseTree' ? t('choose.title', { name: personName(pending.treeId, pending.personId) }) : ''
        }
        confirmLabel={t('choose.useNew')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={t('choose.keep')}
        onSecondary={() => {
          if (pending?.kind === 'chooseTree') stored.showTree(pending.existing)
          setPending(null)
        }}
        onConfirm={() => {
          if (pending?.kind === 'chooseTree') makeTreeOf(pending.treeId, pending.personId)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'chooseTree' && (
          <>
            <p>{t('choose.body', { name: personName(pending.treeId, pending.personId) })}</p>
            <ul className="mt-3 flex flex-col gap-2">
              <li className="rounded-xl border border-stone-200 px-3 py-2">
                {t('choose.existing', { tree: treeName(pending.existing), time: savedTime(pending.existing) })}
              </li>
              <li className="rounded-xl border border-stone-200 px-3 py-2">
                {t('choose.new', { tree: treeName(pending.treeId), time: savedTime(pending.treeId) })}
              </li>
            </ul>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={importPicker.error !== null}
        title={t('import.errorTitle')}
        confirmLabel={t('common.ok')}
        onConfirm={importPicker.clearError}
        onCancel={importPicker.clearError}
      >
        {importPicker.error}
      </ConfirmDialog>
    </>
  )
}

/** One tab's tree, with the sheet for the selected person. */
function TreeTab({
  tab,
  graph,
  tree,
  stored,
  settings,
  onSettingsChange,
  controlsSlot,
  onFork,
  onViewAs,
  onDeleteTree,
  treeName,
}: {
  tab: Tab
  /** The tree as this tab shows it, from the view's root if it's a view. */
  graph: FamilyGraph
  /** The tree itself. */
  tree: FamilyGraph
  stored: StoredTrees
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  controlsSlot: HTMLElement | null
  /** Asks whether an edit in a view should start the root's own tree; `then` runs once it's applied. */
  onFork: (graph: FamilyGraph, then?: () => void) => void
  /** Asks whether to just view the tree from `personId`'s side or make it their tree. */
  onViewAs: (personId: PersonId) => void
  /** Asks to delete this tab's tree. */
  onDeleteTree: () => void
  treeName: string
}) {
  const { t } = useT()
  const [selectedId, setSelectedId] = useState<PersonId | null>(null)
  const closeSheet = useCallback(() => setSelectedId(null), [])

  /** Applies an edit; `then` runs once it is applied, which in a view may wait for a question. */
  const onChange = (edited: FamilyGraph, then?: () => void) => {
    if (!tab.viewRootId) {
      stored.setGraph(tab.treeId, edited)
      return then?.()
    }
    // The tree's own root can't go; the sheet shows this like any other refused edit.
    if (!edited.people[tree.managerId]) {
      throw new GraphError(
        t('view.keepManager', { name: fullName(tree.people[tree.managerId]), tree: treeName }),
      )
    }
    if (tab.editChoice === 'shared') {
      stored.setGraph(tab.treeId, unviewGraph(edited, tree))
      then?.()
    } else onFork(edited, then)
  }

  const ownTreeOf = (personId: PersonId) => linkedTree(stored.trees, tab.treeId, personId)

  const perspectives: Perspectives = {
    // The tree's own root is seen from their side in the tree itself.
    onViewAs: (personId) => (personId === tree.managerId ? stored.showTree(tab.treeId) : onViewAs(personId)),
    onOpenOwnTree: (personId) => {
      const linked = ownTreeOf(personId)
      if (linked) stored.showTree(linked)
    },
    ownTree: (personId) => {
      const linked = ownTreeOf(personId)
      const state = linked ? stored.graphs[linked] : undefined
      if (!state) return null
      const name = state.status === 'ready' ? fullName(state.graph.people[state.graph.managerId]) : null
      return {
        name: name ? t('newTree.treeName', { name }) : t('tabs.damaged'),
        people: state.status === 'ready' ? peopleCount(state.graph) : '?',
      }
    },
    onOpenFile: (personId, file) =>
      void stored.createTree(file, { linkFrom: { treeId: tab.treeId, personId } }),
    isView: Boolean(tab.viewRootId),
    onDeleteTree,
    onRemoveWithTree: (personId, edited) => {
      const linked = ownTreeOf(personId)
      // Only once the removal is applied: in a view, it may still be cancelled.
      onChange(edited, () => linked && void stored.deleteTree(linked))
    },
  }

  return (
    <>
      {/* A different root (import, new start) gets a fresh view and entrance. */}
      <FamilyTree
        key={graph.managerId}
        graph={graph}
        siblingOrder={settings.siblingOrder}
        nameOrder={settings.nameOrder}
        pattern={themeInfo(settings.theme).pattern}
        highlightGender={settings.highlightGender}
        onToggleHighlightGender={() => onSettingsChange({ highlightGender: !settings.highlightGender })}
        selectedId={selectedId}
        onSelect={setSelectedId}
        controlsSlot={controlsSlot}
      />
      <PersonSheet
        graph={graph}
        personId={selectedId}
        onChange={onChange}
        onClose={closeSheet}
        perspectives={perspectives}
      />
    </>
  )
}

export default App
