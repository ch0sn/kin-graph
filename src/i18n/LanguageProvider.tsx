import { useLayoutEffect, type ReactNode } from 'react'
import { LanguageContext } from './context'
import { setCurrentLanguage, type Language } from './core'

/** Sets the language for everything below it, and the page's `lang`. */
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  // Assigned during render so code outside React agrees with what is drawn.
  setCurrentLanguage(language)
  // Before paint, so the Korean face is already applied on the first frame.
  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>
}
