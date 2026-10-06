import { useState } from 'react'
import { useT } from '../i18n'
import { fullName, peopleCount, type FamilyGraph } from '../model'
import { downloadBackup } from '../storage/backup'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/**
 * Asks before a new tree replaces `graph`, which deletes it from this device.
 * It takes two confirmations; the first offers to export a backup.
 */
export function ReplaceTreeConfirm({
  graph,
  onConfirm,
  onCancel,
}: {
  /** The tree to be replaced; the dialog is open while there is one. */
  graph: FamilyGraph | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [step, setStep] = useState<1 | 2>(1)
  const [exported, setExported] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  const close = (then: () => void) => () => {
    setStep(1)
    setExported(false)
    then()
  }

  const treeName = graph ? t('newTree.treeName', { name: fullName(graph.people[graph.managerId]) }) : ''
  const people = graph ? peopleCount(graph) : 0

  return (
    <>
      <ConfirmDialog
        open={graph !== null && step === 1}
        title={t('newTree.title')}
        confirmLabel={t('common.continue')}
        cancelLabel={t('common.cancel')}
        secondaryLabel={exported ? t('newTree.exported') : t('newTree.exportFirst')}
        onSecondary={() => {
          if (graph) downloadBackup(graph).then(() => setExported(true), () => setExportFailed(true))
        }}
        tone="danger"
        onConfirm={() => setStep(2)}
        onCancel={close(onCancel)}
      >
        {t('newTree.bodyBefore')}
        <strong className="font-semibold text-stone-800">{t('newTree.bodyBold')}</strong>
        {t('newTree.bodyAfter', { tree: treeName, people })}
      </ConfirmDialog>

      <ConfirmDialog
        open={graph !== null && step === 2}
        title={t('newTree.finalTitle')}
        confirmLabel={t('newTree.finalConfirm')}
        cancelLabel={t('newTree.finalCancel')}
        tone="danger"
        onConfirm={close(onConfirm)}
        onCancel={close(onCancel)}
      >
        {t('newTree.finalBody', { tree: treeName, people })}
      </ConfirmDialog>

      <ConfirmDialog
        open={exportFailed}
        title={t('export.errorTitle')}
        confirmLabel={t('common.ok')}
        onConfirm={() => setExportFailed(false)}
        onCancel={() => setExportFailed(false)}
      >
        {t('export.errorBody')}
      </ConfirmDialog>
    </>
  )
}
