import { de } from './de'
import { en, type MessageKey } from './en'
import { es } from './es'
import { ko } from './ko'

export type { MessageId, MessageKey } from './en'

/** Languages the app is translated into. Names and the title "KinGraph" are never translated. */
export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
  { id: 'es', name: 'Español' },
  { id: 'ko', name: '한국어' },
] as const

export type Language = (typeof LANGUAGES)[number]['id']
export const LANGUAGE_IDS: readonly Language[] = LANGUAGES.map((l) => l.id)
export const DEFAULT_LANGUAGE: Language = 'en'

const DICTIONARIES: Record<Language, Record<string, string>> = { en, de, es, ko }

export type Params = Record<string, string | number>

/**
 * Looks up a message and fills in `{name}` placeholders. When `count` is
 * given, the plural form is used if there is one: a key `foo` with
 * `foo_one` / `foo_other` variants picks by the language's plural rules.
 */
export function translate(language: Language, key: MessageKey, params?: Params): string {
  const dictionary = DICTIONARIES[language]
  let message: string | undefined
  if (params && typeof params.count === 'number') {
    const form = new Intl.PluralRules(language).select(params.count)
    message = dictionary[`${key}_${form}`] ?? dictionary[`${key}_other`]
  }
  message ??= dictionary[key] ?? (en as Record<string, string>)[key]
  return params
    ? message.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
    : message
}

/**
 * The language of the page right now, for code outside React (the family
 * model builds messages and labels). The provider keeps it in step with
 * what is rendered.
 */
let current: Language = DEFAULT_LANGUAGE

/** Used by the provider, and by tests that need a language without rendering. */
export function setCurrentLanguage(language: Language): void {
  current = language
}

export function currentLanguage(): Language {
  return current
}

export function t(key: MessageKey, params?: Params): string {
  return translate(current, key, params)
}

