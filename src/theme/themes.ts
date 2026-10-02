/**
 * A theme is a look for the whole app: the tint of its neutrals, an accent
 * colour, the shape of the cards, the typeface, line weight and background
 * pattern. Each works in light and dark mode. Names and descriptions are
 * translated: `theme.<id>.name` and `theme.<id>.blurb` in src/i18n. The values themselves live in
 * src/index.css, in a `[data-theme="<id>"]` block per theme.
 */
export type ThemePattern = 'dots' | 'lines' | 'cross' | 'none'

export interface ThemeInfo {
  id: string
  /** The tree's background pattern; the only look that can't be set in CSS. */
  pattern: ThemePattern
}

export const THEMES = [
  { id: 'classic', pattern: 'dots' },
  { id: 'parchment', pattern: 'none' },
  { id: 'forest', pattern: 'dots' },
  { id: 'ocean', pattern: 'dots' },
  { id: 'midnight', pattern: 'cross' },
  { id: 'rose', pattern: 'dots' },
  { id: 'blueprint', pattern: 'lines' },
  { id: 'newsprint', pattern: 'none' },
  { id: 'sunset', pattern: 'dots' },
  { id: 'lavender', pattern: 'dots' },
  { id: 'sketchbook', pattern: 'none' },
  { id: 'terminal', pattern: 'cross' },
] as const satisfies readonly ThemeInfo[]

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id)
export const DEFAULT_THEME: ThemeId = 'classic'

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
