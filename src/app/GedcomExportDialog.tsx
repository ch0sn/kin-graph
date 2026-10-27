import { useMemo } from 'react'
import { GEDCOM_VERSIONS, type GedcomChoices, type GedcomVersion } from '../gedcom/export'
import { LIVING_POLICIES, livingIds, type LivingPolicy } from '../gedcom/privacy'
import { useT } from '../i18n'
import type { FamilyGraph } from '../model'
import { photoIdsOf } from '../storage/backup'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Segmented } from '../ui/fields'

const VERSION_LABEL = { '5.5.1': 'gedcomExport.v551', '7.0': 'gedcomExport.v70' } as const
const LIVING_LABEL = {
  include: 'gedcomExport.include',
  anonymise: 'gedcomExport.anonymise',
  omit: 'gedcomExport.omit',
} as const

/** Before a GEDCOM export: which version, and what to do with people who may be alive. */
export function GedcomExportDialog({
  graph,
  choices,
  onChange,
  onConfirm,
  onCancel,
}: {
  /** The tree to export; the dialog is open while there is one. */
  graph: FamilyGraph | null
  choices: GedcomChoices
  onChange: (choices: GedcomChoices) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  const living = useMemo(() => (graph ? livingIds(graph).size : 0), [graph])
  const hasPhotos = graph !== null && photoIdsOf(graph).length > 0

  return (
    <ConfirmDialog
      open={graph !== null}
      title={t('gedcomExport.title')}
      confirmLabel={t('gedcomExport.confirm')}
      cancelLabel={t('common.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-5">
        <Segmented<GedcomVersion>
          label={t('gedcomExport.version')}
          options={GEDCOM_VERSIONS.map((value) => ({ value, label: t(VERSION_LABEL[value]) }))}
          value={choices.version}
          onChange={(version) => onChange({ ...choices, version })}
        />
        <div className="flex flex-col gap-1.5">
          <Segmented<LivingPolicy>
            label={t('gedcomExport.living')}
            options={LIVING_POLICIES.map((value) => ({ value, label: t(LIVING_LABEL[value]) }))}
            value={choices.living}
            onChange={(policy) => onChange({ ...choices, living: policy })}
          />
          <p className="text-xs text-stone-500">
            {living > 0 ? t('gedcomExport.livingHelp', { people: t('people', { count: living }) }) : t('gedcomExport.livingNone')}
          </p>
        </div>
        {hasPhotos && (
          <div className="flex flex-col gap-1.5">
            <Segmented<'off' | 'on'>
              label={t('gedcomExport.photos')}
              options={[
                { value: 'off', label: t('gedcomExport.photosOff') },
                { value: 'on', label: t('gedcomExport.photosOn') },
              ]}
              value={choices.photos ? 'on' : 'off'}
              onChange={(value) => onChange({ ...choices, photos: value === 'on' })}
            />
            <p className="text-xs text-stone-500">{t('gedcomExport.photosHelp')}</p>
          </div>
        )}
      </div>
    </ConfirmDialog>
  )
}
