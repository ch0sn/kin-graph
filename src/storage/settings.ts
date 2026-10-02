import { DEFAULT_THEME, THEME_IDS, type ThemeId } from '../theme/themes'
import {
  DEFAULT_SIBLING_ORDER,
  SIBLING_ORDERS,
  type SiblingOrder,
} from '../tree/siblingOrder'

/** Follow the device's light or dark setting, or always use one. */
export type ColorMode = 'system' | 'light' | 'dark'
export const COLOR_MODES: readonly ColorMode[] = ['system', 'light', 'dark']

/** Display preferences for this device. They aren't part of the tree or its backups. */
export interface Settings {
  colorMode: ColorMode
  /** The look of the app; see src/theme/themes.ts. */
  theme: ThemeId
  siblingOrder: SiblingOrder
  /** Colours card borders by gender: blue for male, red for female. */
  highlightGender: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  colorMode: 'system',
  theme: DEFAULT_THEME,
  siblingOrder: DEFAULT_SIBLING_ORDER,
  highlightGender: false,
}

const isColorMode = (value: unknown): value is ColorMode =>
  COLOR_MODES.includes(value as ColorMode)

/** Reads stored settings, falling back to the default for anything missing or unknown. */
export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    // Before themes existed, `theme` held the light/dark choice.
    colorMode: isColorMode(stored.colorMode)
      ? stored.colorMode
      : isColorMode(stored.theme)
        ? stored.theme
        : DEFAULT_SETTINGS.colorMode,
    theme: THEME_IDS.includes(stored.theme as ThemeId)
      ? (stored.theme as ThemeId)
      : DEFAULT_SETTINGS.theme,
    siblingOrder: SIBLING_ORDERS.includes(stored.siblingOrder as SiblingOrder)
      ? (stored.siblingOrder as SiblingOrder)
      : DEFAULT_SETTINGS.siblingOrder,
    highlightGender:
      typeof stored.highlightGender === 'boolean'
        ? stored.highlightGender
        : DEFAULT_SETTINGS.highlightGender,
  }
}
