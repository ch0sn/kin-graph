import { initials, type Person } from '../model'
import { usePhotoUrl } from '../photos/photoCache'

/**
 * 4:3 portrait frames. `sm` fills the tree card inside its 8px inset.
 * `md` is the person details header. `lg` and `xl` set the width and the ratio sets the height.
 */
const SIZES = {
  sm: 'h-full w-auto text-base',
  md: 'h-20 w-15 text-xl',
  lg: 'w-20 text-2xl',
  xl: 'w-32 text-3xl',
}

interface AvatarProps {
  person: Pick<Person, 'names' | 'photoId'>
  size?: keyof typeof SIZES
  /** Match the height of the row this sits in. The width follows the 3:4 frame. */
  fill?: boolean
  /** Fill a parent that is already the portrait frame. */
  cover?: boolean
  /** Warm colours for the manager. */
  highlight?: boolean
  /** Shows this image instead of the stored photo, e.g. a photo not saved yet. */
  src?: string | null
  className?: string
}

/** A person's photo, or their initials when there isn't one. Shown as a 4:3 portrait. */
export function Avatar({
  person,
  size = 'sm',
  fill = false,
  cover = false,
  highlight = false,
  src,
  className = '',
}: AvatarProps) {
  const stored = usePhotoUrl(src === undefined ? person.photoId : undefined)
  const url = src === undefined ? stored : src

  return (
    <div
      aria-hidden
      className={[
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-serif',
        cover ? 'size-full' : 'aspect-[3/4]',
        cover ? '' : fill ? 'h-full min-h-20 w-auto' : SIZES[size],
        highlight ? 'bg-(--accent-soft) text-(--accent-ink)' : 'bg-stone-100 text-stone-600',
        url && (highlight ? 'ring-2 ring-(--accent-glow)' : 'ring-1 ring-stone-200'),
        className,
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
