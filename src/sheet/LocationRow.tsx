import { Check, MapPin, Pencil, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { looksLikePostalCode, lookupPostalCode, type Place } from '../places/postalCode'
import { Button, TextInput } from '../ui/fields'
import { HelpLabel } from '../ui/HelpLabel'

interface LocationRowProps {
  location?: string
  /** Countries other people in the tree live in, searched first for postal codes. */
  knownCountries: string[]
  /** The location, and its country code when it came from a postal code lookup. */
  onSave: (location: string | undefined, country: string | undefined) => void
}

/** How long typing has to pause before a postal code is looked up. */
const LOOKUP_DELAY = 600
/** Enough to find the right one without a long list. */
const MAX_CHOICES = 6

type Lookup =
  | { state: 'idle' }
  | { state: 'searching'; code: string }
  | { state: 'filled'; code: string }
  | { state: 'choose'; code: string; places: Place[] }
  | { state: 'none'; code: string }
  | { state: 'failed' }

/**
 * Where the person lives now, edited in place. Typing a postal code looks it
 * up and fills in the town and country, or offers the matches to choose from.
 */
export function LocationRow({ location, knownCountries, onSave }: LocationRowProps) {
  const { t, language } = useT()
  const [editing, setEditing] = useState(false)
  const labelId = useId()
  const helpId = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <HelpLabel
            id={helpId}
            about={t('location.label')}
            help={t('location.hint')}
            label={
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-stone-500" aria-hidden />
                <h3 id={labelId} className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  {t('location.label')}
                </h3>
              </span>
            }
          />
        </div>
        {!editing && (
          <Button variant="ghost" className="-mr-3 ml-auto px-3 py-1.5" onClick={() => setEditing(true)}>
            {location ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {location ? t('location.edit') : t('location.add')}
          </Button>
        )}
      </div>
      {editing ? (
        <LocationEditor
          labelId={labelId}
          helpId={helpId}
          initial={location ?? ''}
          language={language}
          knownCountries={knownCountries}
          onCancel={() => setEditing(false)}
          onSave={(next, country) => {
            const text = next.trim()
            onSave(text || undefined, text ? country : undefined)
            setEditing(false)
          }}
        />
      ) : (
        location && <p className="pl-6 text-sm text-stone-900">{location}</p>
      )}
    </div>
  )
}

function LocationEditor({
  labelId,
  helpId,
  initial,
  language,
  knownCountries,
  onSave,
  onCancel,
}: {
  labelId: string
  /** The "?" tooltip's text, which also describes the field. */
  helpId: string
  initial: string
  language: string
  knownCountries: string[]
  onSave: (location: string, country: string | undefined) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [text, setText] = useState(initial)
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const statusId = useId()
  /** The place the lookup filled in, which shouldn't be looked up again; cleared by typing. */
  const filledRef = useRef<Place | null>(null)
  // A string, so a new array with the same countries doesn't restart a lookup.
  const known = knownCountries.join(',')

  useEffect(() => {
    const code = text.trim()
    const filled = code === filledRef.current?.label
    if (filled || !looksLikePostalCode(code)) {
      if (!filled) setLookup({ state: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLookup({ state: 'searching', code })
      lookupPostalCode(code, { language, knownCountries: known ? known.split(',') : [], signal: controller.signal })
        .then((places) => {
          if (places.length === 1) {
            filledRef.current = places[0]
            setText(places[0].label)
            setLookup({ state: 'filled', code })
          } else if (places.length > 1) {
            setLookup({ state: 'choose', code, places: places.slice(0, MAX_CHOICES) })
          } else {
            setLookup({ state: 'none', code })
          }
        })
        .catch(() => {
          // Offline, rate-limited or the service is down: typing the place still works.
          if (!controller.signal.aborted) setLookup({ state: 'failed' })
        })
    }, LOOKUP_DELAY)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, language, known])

  const choose = (place: Place) => {
    filledRef.current = place
    setText(place.label)
    setLookup({ state: 'filled', code: lookup.state === 'choose' ? lookup.code : '' })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const filled = filledRef.current
    onSave(text, filled && text.trim() === filled.label ? filled.countryCode : undefined)
  }

  const status =
    lookup.state === 'searching'
      ? t('location.searching')
      : lookup.state === 'filled'
        ? t('location.filled', { code: lookup.code })
        : lookup.state === 'none'
          ? t('location.none', { code: lookup.code })
          : lookup.state === 'failed'
            ? t('location.failed')
            : lookup.state === 'choose'
              ? t('location.pick')
              : ''

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 pl-6">
      <TextInput
        aria-labelledby={labelId}
        aria-describedby={`${helpId} ${statusId}`}
        value={text}
        onChange={(e) => {
          filledRef.current = null
          setText(e.target.value)
        }}
        onKeyDown={(e) => {
          // Escape leaves the field, not the whole sheet.
          if (e.key === 'Escape') {
            e.stopPropagation()
            onCancel()
          }
        }}
        placeholder={t('location.placeholder')}
        autoComplete="off"
        autoFocus
      />
      {/* Kept even when empty, so screen readers announce lookups as they happen. */}
      <p id={statusId} role="status" className="text-xs text-stone-500 empty:hidden">
        {status}
      </p>
      {lookup.state === 'choose' && (
        <ul className="flex flex-col gap-1">
          {lookup.places.map((place) => (
            <li key={place.label}>
              <button
                type="button"
                onClick={() => choose(place)}
                className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left text-sm text-stone-800 transition hover:border-stone-300 hover:bg-white focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
              >
                <MapPin className="size-3.5 shrink-0 text-stone-400" aria-hidden />
                {place.detail}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="px-3 py-1.5" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" className="px-3 py-1.5">
          <Check className="size-4" aria-hidden />
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
