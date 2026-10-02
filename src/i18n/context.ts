import { createContext, useContext } from 'react'
import { DEFAULT_LANGUAGE, translate, type Language, type MessageKey, type Params } from './core'

export const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE)

/** Translation for components; they re-render when the language changes. */
export function useT() {
  const language = useContext(LanguageContext)
  return {
    language,
    t: (key: MessageKey, params?: Params) => translate(language, key, params),
  }
}
