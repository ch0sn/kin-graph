import { TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import type { FamilyGraph } from '../model'
import { useT } from '../i18n'
import { useBackupPicker } from '../storage/useBackupPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'

/**
 * Shown when the saved tree can't be read. Nothing is overwritten until the
 * person imports a backup or chooses to start over.
 */
export function DamagedTree({
  message,
  onImport,
  onStartOver,
}: {
  message: string
  onImport: (graph: FamilyGraph) => void
  onStartOver: () => void
}) {
  const { t } = useT()
  const picker = useBackupPicker(onImport)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="h-full overflow-y-auto bg-stone-50 px-4">
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-5 py-10">
        <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700">
          <TriangleAlert className="size-7" aria-hidden />
        </div>
        <h1 className="font-serif text-3xl leading-tight text-stone-900">
          {t('damaged.title')}
        </h1>
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
          {message}
        </p>
        <p className="text-sm leading-relaxed text-stone-600">
          {t('damaged.body')}
        </p>
        {picker.input}
        {picker.error && (
          <p role="alert" className="text-sm text-red-800">
            {picker.error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" className="flex-1 py-3" onClick={picker.open}>
            <Upload className="size-4" aria-hidden />
            {t('damaged.import')}
          </Button>
          <Button className="flex-1 py-3" onClick={() => setConfirming(true)}>
            {t('damaged.startOver')}
          </Button>
        </div>
      </main>

      <ConfirmDialog
        open={confirming}
        title={t('damaged.confirmTitle')}
        confirmLabel={t('damaged.confirmButton')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={() => {
          setConfirming(false)
          onStartOver()
        }}
        onCancel={() => setConfirming(false)}
      >
        {t('damaged.confirmBody')}
      </ConfirmDialog>
    </div>
  )
}
