import { ChevronDown, Globe } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { suggestCities } from '../places/cities'
import {
  countryOptions,
  flagEmoji,
  formatPlace,
  parsePlace,
  type CountryOption,
} from '../places/countries'
import { preferredCountries } from '../places/postalCode'
import { foldMarks } from '../places/speak'
import { TextInput } from './fields'

/**
 * A place as a country and, when wanted, a city. The country takes about
 * 30% of the row so its flag and code fit; the city takes the rest and stays
 * locked until a country is chosen. After a couple of characters, cities
 * from that country are suggested, including look-alike and similar-sounding
 * spellings. Stored as written: "Berlin, Germany".
 */
export function PlaceField({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** A short note under the label, smaller than the fields. */
  help?: string
}) {
  const { t, language } = useT()
  const { country, city } = parsePlace(value)
  const listId = useId()
  const helpId = useId()
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeCity, setActiveCity] = useState(-1)
  const suggestions = suggestionsOpen ? suggestCities(country, city) : []
  const hasSuggestions = suggestions.length > 0

  const change = (nextCountry: string, nextCity: string) => onChange(formatPlace(nextCountry, nextCity, language))

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={help ? helpId : undefined}>
      <legend className="mb-1.5 w-full">
        <span className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{label}</span>
        {help && (
          <p id={helpId} className="mt-1 text-xs leading-snug font-normal tracking-normal text-stone-400 normal-case">
            {help}
          </p>
        )}
      </legend>
      <CountrySelect
        country={country}
        onChange={(next) => {
          setSuggestionsOpen(false)
          if (!next || next !== country) change(next, '')
        }}
        onOpen={() => setSuggestionsOpen(false)}
      >
        <TextInput
          role="combobox"
          aria-label={t('form.city')}
          aria-autocomplete="list"
          aria-controls={hasSuggestions ? listId : undefined}
          aria-expanded={hasSuggestions}
          aria-activedescendant={suggestions[activeCity] ? `${listId}-${activeCity}` : undefined}
          value={city}
          placeholder={t('form.cityPlaceholder')}
          disabled={!country}
          aria-describedby={help ? helpId : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setSuggestionsOpen(true)
            setActiveCity(-1)
            change(country, event.target.value)
          }}
          onBlur={() => setSuggestionsOpen(false)}
          onKeyDown={(event) => {
            if (!hasSuggestions || event.nativeEvent.isComposing) return
            if (event.key === 'Escape') {
              event.stopPropagation()
              setSuggestionsOpen(false)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveCity((current) => Math.min(current + 1, suggestions.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveCity((current) => current < 0 ? suggestions.length - 1 : Math.max(current - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              setSuggestionsOpen(false)
              if (suggestions[activeCity]) change(country, suggestions[activeCity])
            }
          }}
        />
      </CountrySelect>
      {hasSuggestions && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('place.suggestions')}
          className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion}>
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeCity}
                className={`w-full px-3 py-2 text-left text-sm text-stone-800 ${index === activeCity ? 'bg-stone-100' : 'hover:bg-stone-100'}`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSuggestionsOpen(false)
                  change(country, suggestion)
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

function CountrySelect({
  country,
  onChange,
  onOpen,
  children,
}: {
  country: string
  onChange: (country: string) => void
  onOpen: () => void
  children: ReactNode
}) {
  const { t, language } = useT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const emptyOptionId = `${listId}-empty`
  const options = useMemo(() => countryOptions(language), [language])
  const shown = useMemo(() => filterCountries(options, search, language), [options, search, language])
  const name = country ? (options.find((option) => option.code === country)?.name ?? country) : ''
  const optionId = (index: number) => index === -1 ? emptyOptionId : shown[index] && `${listId}-${shown[index].code}`

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const openSearch = () => {
    onOpen()
    setSearch('')
    setActive(0)
    setOpen(true)
  }

  const closeFromSearch = () => {
    // Restore focus while still open so the trigger's focus handler won't reopen it.
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(false)
  }

  const choose = (code: string) => {
    onChange(code)
    closeFromSearch()
  }

  const moveActive = (direction: number) => {
    const next = Math.max(-1, Math.min(active + direction, shown.length - 1))
    setActive(next)
    const list = listRef.current
    const id = optionId(next)
    const option = id && list?.ownerDocument.getElementById(id)
    if (!list || !option) return
    const { top, bottom } = option.getBoundingClientRect()
    const listBounds = list.getBoundingClientRect()
    // Scroll just the list, leaving the surrounding form in place.
    if (top < listBounds.top) list.scrollTop += Math.floor(top - listBounds.top)
    else if (bottom > listBounds.bottom) list.scrollTop += Math.ceil(bottom - listBounds.bottom)
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(7.25rem,3fr)_minmax(0,7fr)] gap-2">
        <button
          ref={triggerRef}
          type="button"
          aria-label={name ? `${t('form.country')}, ${name}` : t('form.country')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onFocus={(event) => {
            if (!open && event.currentTarget.matches(':focus-visible')) openSearch()
          }}
          onClick={() => (open ? setOpen(false) : openSearch())}
          className="flex min-w-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-2.5 text-base text-stone-900 outline-none focus:border-stone-500 focus:ring-4 focus:ring-stone-200"
        >
          {country ? (
            <>
              <span className="text-base leading-none" aria-hidden>
                {flagEmoji(country)}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-wide">{country}</span>
            </>
          ) : (
            <Globe className="size-4 shrink-0 text-stone-400" aria-hidden />
          )}
          <ChevronDown className="ml-auto size-4 shrink-0 text-stone-500" aria-hidden />
        </button>
        {children}
      </div>
      {open && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 p-2">
            <TextInput
              aria-label={t('form.countrySearch')}
              aria-controls={listId}
              aria-activedescendant={optionId(active)}
              value={search}
              placeholder={t('form.countrySearch')}
              autoComplete="off"
              autoFocus
              onChange={(event) => {
                setSearch(event.target.value)
                setActive(0)
                if (listRef.current) listRef.current.scrollTop = 0
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  closeFromSearch()
                  return
                }
                if (event.key === 'Tab') {
                  // Let the browser continue tabbing from the trigger in either direction.
                  closeFromSearch()
                  return
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveActive(1)
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  moveActive(-1)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  const option = shown[active]
                  if (active === -1) choose('')
                  else if (option) choose(option.code)
                }
              }}
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={t('form.country')} className="max-h-52 overflow-y-auto">
            <li>
              <button
                type="button"
                id={emptyOptionId}
                role="option"
                aria-label={t('common.remove')}
                aria-selected={!country}
                className={`w-full px-3 py-2 text-left text-sm text-stone-500 ${active === -1 ? 'bg-stone-100' : 'hover:bg-stone-100'}`}
                onMouseMove={() => setActive(-1)}
                onClick={() => choose('')}
              >
                —
              </button>
            </li>
            {shown.map((option, index) => (
              <li key={option.code}>
                <button
                  type="button"
                  id={`${listId}-${option.code}`}
                  role="option"
                  aria-selected={option.code === country}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    index === active ? 'bg-stone-100' : 'hover:bg-stone-50',
                  ].join(' ')}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(option.code)}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {option.flag}
                  </span>
                  <span className="w-7 shrink-0 text-xs font-semibold tracking-wide text-stone-500">{option.code}</span>
                  <span className="truncate text-stone-800">{option.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function filterCountries(options: CountryOption[], search: string, language: string): CountryOption[] {
  const query = foldMarks(search.trim())
  const preferred = new Set(preferredCountries([language]).map((code) => code.toUpperCase()))
  const matched = query
    ? options.filter(
        (option) => option.code.toLowerCase().startsWith(query) || foldMarks(option.name).includes(query),
      )
    : options
  return matched.sort((a, b) => {
    const rank = (option: CountryOption) => {
      if (!query) return preferred.has(option.code) ? 0 : 1
      if (option.code.toLowerCase() === query) return 0
      if (option.code.toLowerCase().startsWith(query)) return 1
      if (foldMarks(option.name).startsWith(query)) return 2
      return 3
    }
    return rank(a) - rank(b) || a.name.localeCompare(b.name, language)
  })
}
