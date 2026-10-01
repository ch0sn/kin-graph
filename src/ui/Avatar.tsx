import { initials, type Person } from '../model'
import { usePhotoUrl } from '../photos/photoCache'

const SIZES = {
  sm: 'size-11 text-lg',
  md: 'size-14 text-xl',
  lg: 'size-20 text-2xl',
}

interface AvatarProps {
  person: Pick<Person, 'givenName' | 'familyName' | 'photoId'>
  size?: keyof typeof SIZES
  /** Warm colours for the manager. */
  highlight?: boolean
  /** Shows this image instead of the stored photo, e.g. a photo not saved yet. */
  src?: string | null
}

/** A person's photo, or their initials when there isn't one. */
export function Avatar({ person, size = 'sm', highlight = false, src }: AvatarProps) {
  const stored = usePhotoUrl(src === undefined ? person.photoId : undefined)
  const url = src === undefined ? stored : src

  return (
    <div
      aria-hidden
      className={[
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-serif',
        SIZES[size],
        highlight ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600',
        url && (highlight ? 'ring-2 ring-amber-200' : 'ring-1 ring-stone-200'),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        initials(person)
      )}
    </div>
  )
}
