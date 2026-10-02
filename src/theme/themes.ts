/**
 * A theme is a look for the whole app: the tint of its neutrals, an accent
 * colour, the shape of the cards, the typeface, line weight and background
 * pattern. Each works in light and dark mode. The values themselves live in
 * src/index.css, in a `[data-theme="<id>"]` block per theme.
 */
export type ThemePattern = 'dots' | 'lines' | 'cross' | 'none'

export interface ThemeInfo {
  id: string
  name: string
  blurb: string
  /** The tree's background pattern; the only look that can't be set in CSS. */
  pattern: ThemePattern
}

export const THEMES = [
  { id: 'classic', name: 'Classic', blurb: 'Soft, warm and rounded.', pattern: 'dots' },
  { id: 'parchment', name: 'Parchment', blurb: 'Aged paper and a scholar’s serif.', pattern: 'none' },
  { id: 'forest', name: 'Forest', blurb: 'Mossy greens, like a family oak.', pattern: 'dots' },
  { id: 'ocean', name: 'Ocean', blurb: 'Cool, calm and roomy.', pattern: 'dots' },
  { id: 'midnight', name: 'Midnight', blurb: 'Deep indigo with a starry grid.', pattern: 'cross' },
  { id: 'rose', name: 'Rosé', blurb: 'Gentle pinks and pill-shaped cards.', pattern: 'dots' },
  { id: 'blueprint', name: 'Blueprint', blurb: 'Technical drawing on a grid.', pattern: 'lines' },
  { id: 'newsprint', name: 'Newsprint', blurb: 'Black ink, square corners, no frills.', pattern: 'none' },
  { id: 'sunset', name: 'Sunset', blurb: 'Warm coral and golden hour.', pattern: 'dots' },
  { id: 'lavender', name: 'Lavender', blurb: 'Soft purples and a friendly serif.', pattern: 'dots' },
  { id: 'sketchbook', name: 'Sketchbook', blurb: 'Hand-drawn and a little wobbly.', pattern: 'none' },
  { id: 'terminal', name: 'Terminal', blurb: 'Monospace on a green-tinted grid.', pattern: 'cross' },
] as const satisfies readonly ThemeInfo[]

export type ThemeId = (typeof THEMES)[number]['id']

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id)
export const DEFAULT_THEME: ThemeId = 'classic'

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
