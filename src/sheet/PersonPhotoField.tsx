import { Camera } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { useT } from '../i18n'
import { PhotoCropDialog } from '../photos/PhotoCropDialog'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/fields'
import type { PersonPhoto } from './usePersonPhoto'

/**
 * The photo control: a compact one in the person editor, a large one while starting a tree.
 * In the editor, `children` (the name fields) fill the space beside the photo.
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
  const hasPhoto = photo.pendingUrl !== null || photo.photoId !== ''
  // The person editor puts the shown name in the space beside the photo.
  const beside = !prominent && children != null

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
      aria-label={hasPhoto ? t('form.changePhoto') : t('form.addPhoto')}
      className={[
        'group relative shrink-0 rounded-xl focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none',
        // The button is the grid item. A wrapper around it collapses and the frame overlaps the names.
        beside ? 'col-start-2 aspect-[3/4] h-full w-auto' : '',
      ].join(' ')}
    >
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
    </button>
  )

  const actions = (hasPhoto || photo.error) && (
    <div
      className={
        prominent
          ? 'flex flex-col items-center gap-1'
          : beside
            ? 'flex flex-col items-start gap-1'
            : 'flex min-w-0 flex-col items-start gap-1'
      }
    >
      {hasPhoto && (
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
            <Button variant="ghost" className="px-3 py-1.5" onClick={photo.adjust}>
              {t('form.adjust')}
            </Button>
          )}
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={photo.remove}
          >
            {t('common.remove')}
          </Button>
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

  // Names sit in the column beside the photo. Adjust and remove stay under that row,
  // so they don't take the space the name fields use. The parent grid supplies the columns.
  if (beside) {
    return (
      <div className="contents">
        {avatarButton}
        <div className="col-start-4 min-w-0">{children}</div>
        {actions && <div className="col-span-4 pl-5">{actions}</div>}
        {fileControls}
      </div>
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
