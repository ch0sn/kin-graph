import { useEffect } from 'react'
import type { ColorMode } from '../storage/settings'
import type { ThemeId } from '../theme/themes'

/**
 * Copies of the light/dark mode and the theme in localStorage, read by the
 * script in index.html so they apply before the first paint. The settings
 * themselves are kept with the others in IndexedDB.
 */
export const COLOR_MODE_STORAGE_KEY = 'kingraph-color-mode'
export const THEME_STORAGE_KEY = 'kingraph-theme-id'

/** Browser chrome colours: the page colour in light and dark. */
const CHROME_COLORS = { light: '#fafaf9', dark: '#0c0a09' }

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function applyColorMode(mode: ColorMode) {
  const dark = mode === 'dark' || (mode === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CHROME_COLORS[dark ? 'dark' : 'light'])
}

/** Applies the theme and light/dark mode to the page; "system" follows the device. */
export function useAppearance(colorMode: ColorMode | null, theme: ThemeId | null) {
  useEffect(() => {
    if (!theme) return
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Without localStorage it still applies; it may just flash on load.
    }
  }, [theme])

  useEffect(() => {
    if (!colorMode) return
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode)
    } catch {
      // As above.
    }
    applyColorMode(colorMode)
    if (colorMode !== 'system') return
    const media = darkQuery()
    const follow = () => applyColorMode('system')
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [colorMode])
}
