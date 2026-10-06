import { DEFAULT_LANGUAGE, LANGUAGE_IDS, type Language } from '../i18n'
import type { NameOrder } from '../model'
import { DEFAULT_THEME, THEME_IDS, type ThemeId } from '../theme/themes'
import {
  DEFAULT_SIBLING_ORDER,
  SIBLING_ORDERS,
  type SiblingOrder,
} from '../tree/siblingOrder'

/** Follow the device's light or dark setting, or always use one. */
export type ColorMode = 'system' | 'light' | 'dark'
export const COLOR_MODES: readonly ColorMode[] = ['system', 'light', 'dark']

/**
 * Which colours highlight you and a person's line of ancestry, for the kinds
 * of colour blindness. "monochrome" uses no hue at all, only black and white.
 */
export type ColorVision = 'standard' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome'
export const COLOR_VISIONS: readonly ColorVision[] = [
  'standard',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'monochrome',
]

/** Display preferences for this device. They aren't part of the tree or its backups. */
export interface Settings {
  /** The language of the app (not of names or the title). */
  language: Language
  colorMode: ColorMode
  /** The look of the app; see src/theme/themes.ts. */
  theme: ThemeId
  /** Colours for highlighting, chosen for the kind of colour blindness; see `ColorVision`. */
  colorVision: ColorVision
  siblingOrder: SiblingOrder
  /** How names are written, except Korean, Chinese and Japanese ones, which are always family-first. */
  nameOrder: NameOrder
  /** Colours card borders by gender: blue for male, red for female. */
  highlightGender: boolean
  /** What closing a tab does to its tree: keep it in "My trees", delete it, or ask. */
  closeTab: CloseTabAction
  /** Where a new or imported tree opens: in a new tab, or in place of the current one. */
  newTreeIn: NewTreeTarget
  /** Which tabs are open when KinGraph starts. */
  onStart: StartTabs
}

export type CloseTabAction = 'keep' | 'delete' | 'ask'
export const CLOSE_TAB_ACTIONS: readonly CloseTabAction[] = ['keep', 'delete', 'ask']
export type NewTreeTarget = 'new-tab' | 'replace'
export const NEW_TREE_TARGETS: readonly NewTreeTarget[] = ['new-tab', 'replace']
export type StartTabs = 'last-tabs' | 'own-tree'
export const START_TABS: readonly StartTabs[] = ['last-tabs', 'own-tree']

export const DEFAULT_SETTINGS: Settings = {
  language: DEFAULT_LANGUAGE,
  colorMode: 'system',
  theme: DEFAULT_THEME,
  colorVision: 'standard',
  siblingOrder: DEFAULT_SIBLING_ORDER,
  nameOrder: 'given-first',
  highlightGender: false,
  closeTab: 'keep',
  newTreeIn: 'new-tab',
  onStart: 'last-tabs',
}

const oneOf = <T>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

const isColorMode = (value: unknown): value is ColorMode =>
  COLOR_MODES.includes(value as ColorMode)

/** Reads stored settings, falling back to the default for anything missing or unknown. */
export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    language: LANGUAGE_IDS.includes(stored.language as Language)
      ? (stored.language as Language)
      : DEFAULT_SETTINGS.language,
    // Before themes existed, `theme` held the light/dark choice.
    colorMode: isColorMode(stored.colorMode)
      ? stored.colorMode
      : isColorMode(stored.theme)
        ? stored.theme
        : DEFAULT_SETTINGS.colorMode,
    theme: THEME_IDS.includes(stored.theme as ThemeId)
      ? (stored.theme as ThemeId)
      : DEFAULT_SETTINGS.theme,
    colorVision: COLOR_VISIONS.includes(stored.colorVision as ColorVision)
      ? (stored.colorVision as ColorVision)
      : DEFAULT_SETTINGS.colorVision,
    siblingOrder: SIBLING_ORDERS.includes(stored.siblingOrder as SiblingOrder)
      ? (stored.siblingOrder as SiblingOrder)
      : DEFAULT_SETTINGS.siblingOrder,
    nameOrder:
      stored.nameOrder === 'given-first' || stored.nameOrder === 'family-first'
        ? stored.nameOrder
        : DEFAULT_SETTINGS.nameOrder,
    highlightGender:
      typeof stored.highlightGender === 'boolean'
        ? stored.highlightGender
        : DEFAULT_SETTINGS.highlightGender,
    closeTab: oneOf(CLOSE_TAB_ACTIONS, stored.closeTab, DEFAULT_SETTINGS.closeTab),
    newTreeIn: oneOf(NEW_TREE_TARGETS, stored.newTreeIn, DEFAULT_SETTINGS.newTreeIn),
    onStart: oneOf(START_TABS, stored.onStart, DEFAULT_SETTINGS.onStart),
  }
}
