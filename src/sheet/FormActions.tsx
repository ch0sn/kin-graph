import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Button } from '../ui/fields'
import { FormActionsSlot } from './formActionsSlot'

/**
 * A form's Cancel and submit buttons: in the header above the form when
 * there is one, otherwise below it. The submit button names its form, so it
 * works from outside it too. In the header, whose title already says what
 * the form does, it's simply "Save", to leave the title room.
 */
export function FormActions({
  formId,
  submitLabel,
  onCancel,
  busy = false,
}: {
  formId: string
  submitLabel: string
  onCancel?: () => void
  busy?: boolean
}) {
  const { t } = useT()
  const slot = useContext(FormActionsSlot)
  const inHeader = slot !== undefined
  const size = inHeader ? 'px-3 py-1.5' : ''
  const buttons = (
    <>
      {onCancel && (
        <Button variant="ghost" className={size} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      )}
      <Button variant="primary" type="submit" form={formId} className={size} disabled={busy}>
        {inHeader ? t('common.save') : submitLabel}
      </Button>
    </>
  )
  if (!inHeader) return <div className="flex justify-end gap-2 pt-1">{buttons}</div>
  return slot ? createPortal(buttons, slot) : null
}
