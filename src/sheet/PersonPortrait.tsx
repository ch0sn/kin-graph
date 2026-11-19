import { X } from 'lucide-react'
import { useRef } from 'react'
import { useT } from '../i18n'
import { fullName, type Person } from '../model'
import { usePhotoUrl } from '../photos/photoCache'
import { Avatar } from '../ui/Avatar'

export function PersonPortrait({ person, isManager }: { person: Person; isManager: boolean }) {
  const { t } = useT()
  const photo = usePhotoUrl(person.photoId)
  const dialog = useRef<HTMLDialogElement>(null)
  const previewLabel = t('photo.preview')

  return (
    <>
      <div className="relative flex shrink-0 sm:self-stretch">
        <div className="aspect-[3/4] h-[60px] sm:hidden">
          <Avatar person={person} src={photo} cover highlight className="rounded-[9px]! text-sm" />
        </div>
        <Avatar
          person={person}
          src={photo}
          fill
          highlight={isManager}
          className="relative hidden! sm:flex! [&>img]:absolute"
        />
        {photo && (
          <button
            type="button"
            aria-label={previewLabel}
            aria-haspopup="dialog"
            title={previewLabel}
            className="absolute inset-0 cursor-zoom-in rounded-[9px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent) sm:rounded-xl"
            onClick={() => dialog.current?.showModal()}
          />
        )}
      </div>
      {photo && (
        <dialog
          ref={dialog}
          aria-label={previewLabel}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close()
          }}
          className="m-auto w-[min(32rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-black p-0 shadow-2xl backdrop:bg-black/70 motion-safe:open:animate-[dialog-in_160ms_ease-out]"
        >
          <img
            src={photo}
            alt={fullName(person)}
            className="block max-h-[calc(100dvh-2rem)] w-full object-contain"
          />
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/70 text-[#fff] hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff]"
            onClick={() => dialog.current?.close()}
          >
            <X className="size-5" aria-hidden />
          </button>
        </dialog>
      )}
    </>
  )
}
