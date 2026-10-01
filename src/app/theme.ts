import { useEffect } from 'react'
import type { Theme } from '../storage/settings'

/**
 * A copy of the theme in localStorage, read by the script in index.html so
 * the right theme is applied before the first paint. The setting itself is
 * kept with the other settings in IndexedDB.
 */
export const THEME_STORAGE_KEY = 'kingraph-theme'

/** Browser chrome colours: stone-50 for light, the dark page colour for dark. */
const THEME_COLORS = { light: '#fafaf9', dark: '#0c0a09' }

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[dark ? 'dark' : 'light'])
}

/** Applies the theme to the page, following the device while it's set to "system". */
export function useTheme(theme: Theme | null) {
  useEffect(() => {
    if (!theme) return
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Without localStorage the theme still applies; it may just flash on load.
    }
    apply(theme)
    if (theme !== 'system') return
    const media = darkQuery()
    const follow = () => apply('system')
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [theme])
}
