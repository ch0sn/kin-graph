import { Camera, Trash } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { PhotoCropDialog } from '../photos/PhotoCropDialog'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'
import type { PersonPhoto } from './usePersonPhoto'

/**
 * The photo control: a compact one in the person editor, a large one while starting a tree.
 * In the editor, `children` are the name fields beside the photo.
 */
export function PersonPhotoField({
  photo,
  given,
  prominent = false,
  children,
}: {
  photo: PersonPhoto
  given: string
  prominent?: boolean
  /** Fills the space beside the photo. Used for the shown name in the person editor. */
  children?: ReactNode
}) {
  const { t } = useT()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const hasPhoto = photo.pendingUrl !== null || photo.photoId !== ''
  const beside = !prominent && children != null
  const hasPhotoActions = photo.canAdjust || (!beside && hasPhoto)
  const photoLabel = hasPhoto ? t('form.changePhoto') : t('form.addPhoto')
  const removeLabel = t('form.removePhoto')

  const picture = hasPhoto ? (
    <Avatar
      person={{ names: [{ given }], photoId: photo.photoId || undefined }}
      size={prominent ? 'xl' : 'lg'}
      cover={beside}
      src={photo.pendingUrl ?? undefined}
    />
  ) : (
    <span
      className={[
        'flex items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 transition group-hover:border-stone-400 group-hover:text-stone-600',
        beside ? 'size-full' : 'aspect-[3/4]',
        prominent ? 'w-32' : beside ? '' : 'w-20',
      ].join(' ')}
    >
      <Camera className={prominent ? 'size-10' : 'size-7'} strokeWidth={1.5} aria-hidden />
    </span>
  )

  const avatarButton = (
    <button
      type="button"
      onClick={() => fileInput.current?.click()}
      aria-label={photoLabel}
      className={[
        'group relative shrink-0 rounded-xl focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        beside ? 'col-start-1 row-start-1 block aspect-[3/4] w-full self-start sm:col-start-2 sm:h-full sm:w-auto sm:self-stretch' : '',
      ].join(' ')}
    >
      {/* The portrait fills the grid item without contributing its intrinsic image size. */}
      <span className={beside ? 'absolute inset-0 size-full' : 'contents'}>
        {prominent && hasPhoto ? (
          <motion.span
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="block"
          >
            {picture}
          </motion.span>
        ) : (
          picture
        )}
        {hasPhoto && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-white">
            <Camera className="size-3.5" aria-hidden />
          </span>
        )}
      </span>
    </button>
  )

  const actions = (hasPhotoActions || photo.error) && (
    <div
      className={
        prominent
          ? 'flex flex-col items-center gap-1'
          : beside
            ? 'flex flex-col items-start gap-1'
            : 'flex min-w-0 flex-col items-start gap-1'
      }
    >
      {hasPhotoActions && (
        <div
          className={
            prominent
              ? 'flex flex-wrap justify-center gap-1'
              : beside
                ? 'flex flex-wrap gap-1'
                : '-ml-3 flex flex-wrap gap-1'
          }
        >
          {photo.canAdjust && (
            <Button variant="ghost" className="px-3 py-1.5 max-sm:min-h-11" onClick={photo.adjust}>
              {t('form.adjust')}
            </Button>
          )}
          {!beside && (
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-red-700 hover:bg-red-50 hover:text-red-800 max-sm:min-h-11"
              aria-label={removeLabel}
              title={removeLabel}
              onClick={photo.remove}
            >
              {t('common.remove')}
            </Button>
          )}
        </div>
      )}
      {photo.error && <p className="text-xs text-red-700">{photo.error}</p>}
    </div>
  )

  const fileControls = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="photo-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) photo.chooseFile(file)
        }}
      />
      <PhotoCropDialog
        source={photo.cropping?.source ?? null}
        initialCrop={photo.cropping?.crop ?? null}
        onConfirm={photo.confirmCrop}
        onCancel={photo.cancelCrop}
      />
    </>
  )

  if (beside) {
    return (
      <>
        {avatarButton}
        {hasPhoto && (
          <button
            type="button"
            aria-label={removeLabel}
            title={removeLabel}
            aria-haspopup="dialog"
            onClick={() => setConfirmingRemoval(true)}
            className="relative z-1 col-start-1 row-start-1 -mt-0.5 -mr-0.5 grid size-7 place-items-center self-start justify-self-end rounded-full border-2 border-white bg-white text-red-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) max-sm:after:absolute max-sm:after:-inset-2.5 sm:col-start-2"
          >
            <Trash className="size-3.5" aria-hidden />
          </button>
        )}
        <div className="col-start-2 row-start-1 min-w-0 sm:col-start-4">{children}</div>
        {actions && <div className="col-span-2 sm:col-span-4 sm:pl-5">{actions}</div>}
        {fileControls}
        <ConfirmDialog
          open={confirmingRemoval}
          title={t('form.removePhotoTitle')}
          confirmLabel={removeLabel}
          cancelLabel={t('common.cancel')}
          tone="danger"
          onCancel={() => setConfirmingRemoval(false)}
          onConfirm={() => {
            setConfirmingRemoval(false)
            photo.remove()
          }}
        >
          {t('form.removePhotoBody')}
        </ConfirmDialog>
      </>
    )
  }

  return (
    <div className={prominent ? 'flex flex-col items-center gap-4' : 'flex items-center gap-4'}>
      {avatarButton}
      {actions}
      {fileControls}
    </div>
  )
}
