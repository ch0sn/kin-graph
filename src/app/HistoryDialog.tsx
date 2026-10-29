import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import type { FamilyGraph } from '../model'
import { downloadBackup } from '../storage/backup'
import { loadSnapshots } from '../storage/db'
import { diffPeople, type Snapshot } from '../storage/snapshots'
import type { LastBackup } from '../storage/useStoredTree'
import type { TreeId } from '../storage/workspace'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'

/** The copies of a tree kept on this device, to restore or export. */
export function HistoryDialog({
  tree,
  onRestore,
  onClose,
  lastBackup,
}: {
  /** The tree whose history to show; the dialog is open while there is one. */
  tree: { id: TreeId; name: string; graph: FamilyGraph } | null
  onRestore: (snapshot: Snapshot) => void
  onClose: () => void
  /** Undefined while loading. */
  lastBackup: LastBackup | undefined
}) {
  const { t, language } = useT()
  const [loaded, setLoaded] = useState<{ treeId: TreeId; snapshots: Snapshot[] } | null>(null)
  const treeId = tree?.id
  // Each time it opens, until they're read again.
  const snapshots = loaded && loaded.treeId === treeId ? loaded.snapshots : null

  useEffect(() => {
    if (!treeId) return
    let cancelled = false
    loadSnapshots(treeId).then(
      (snapshots) => !cancelled && setLoaded({ treeId, snapshots }),
      () => !cancelled && setLoaded({ treeId, snapshots: [] }),
    )
    return () => {
      cancelled = true
      setLoaded(null)
    }
  }, [treeId])

  const time = (ms: number) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)
  const day = (ms: number) => new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(ms)

  const changes = (snapshot: Snapshot) => {
    if (!tree) return ''
    const diff = diffPeople(snapshot.graph, tree.graph)
    const parts = [
      diff.added > 0 && t('history.added', { count: diff.added }),
      diff.removed > 0 && t('history.removed', { count: diff.removed }),
      diff.changed > 0 && t('history.changed', { count: diff.changed }),
    ].filter((part): part is string => Boolean(part))
    if (parts.length > 0) return t('history.since', { changes: parts.join(', ') })
    return JSON.stringify(snapshot.graph) === JSON.stringify(tree.graph)
      ? t('history.same')
      : t('history.since', { changes: t('history.otherChanges') })
  }

  return (
    <ConfirmDialog
      open={tree !== null}
      title={t('history.title')}
      confirmLabel={t('common.done')}
      onConfirm={onClose}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-4">
        <p>{tree && t('history.body', { tree: tree.name })}</p>
        {lastBackup && (
          <div
            className={[
              'flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2',
              lastBackup.isOld ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600',
            ].join(' ')}
          >
            <span>{lastBackup.at ? t('history.lastBackup', { date: day(lastBackup.at) }) : t('history.noBackup')}</span>
            {lastBackup.isOld && tree && (
              <Button className="px-3 py-1.5" onClick={() => void downloadBackup(tree.graph).catch(() => {})}>
                {t('history.backupNow')}
              </Button>
            )}
          </div>
        )}
        {snapshots?.length === 0 && <p className="text-stone-500">{t('history.empty')}</p>}
        {snapshots && snapshots.length > 0 && (
          <ul className="-mx-2 flex max-h-[45vh] flex-col overflow-y-auto">
            {snapshots.map((snapshot) => {
              const summary = changes(snapshot)
              const same = summary === t('history.same')
              return (
                <li key={snapshot.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800">{time(snapshot.takenAt)}</p>
                    <p className="text-xs text-stone-500">
                      {t(`history.reason.${snapshot.reason}`)} · {summary}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5"
                    title={t('history.exportTitle')}
                    onClick={() => void downloadBackup(snapshot.graph, { remember: false }).catch(() => {})}
                  >
                    {t('history.export')}
                  </Button>
                  <Button className="px-2.5 py-1.5 disabled:pointer-events-none disabled:opacity-40" disabled={same} onClick={() => onRestore(snapshot)}>
                    {t('history.restore')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ConfirmDialog>
  )
}
