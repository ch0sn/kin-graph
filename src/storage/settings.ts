import {
  DEFAULT_SIBLING_ORDER,
  SIBLING_ORDERS,
  type SiblingOrder,
} from '../tree/siblingOrder'

/** Follow the device's light or dark setting, or always use one. */
export type Theme = 'system' | 'light' | 'dark'
export const THEMES: readonly Theme[] = ['system', 'light', 'dark']

/** Display preferences for this device. They aren't part of the tree or its backups. */
export interface Settings {
  theme: Theme
  siblingOrder: SiblingOrder
  /** Colours card borders by gender: blue for male, red for female. */
  highlightGender: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  siblingOrder: DEFAULT_SIBLING_ORDER,
  highlightGender: false,
}

/** Reads stored settings, falling back to the default for anything missing or unknown. */
export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    theme: THEMES.includes(stored.theme as Theme)
      ? (stored.theme as Theme)
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
