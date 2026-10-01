import {
  DEFAULT_SIBLING_ORDER,
  SIBLING_ORDERS,
  type SiblingOrder,
} from '../tree/siblingOrder'

/** Display preferences for this device. They aren't part of the tree or its backups. */
export interface Settings {
  siblingOrder: SiblingOrder
}

export const DEFAULT_SETTINGS: Settings = { siblingOrder: DEFAULT_SIBLING_ORDER }

/** Reads stored settings, falling back to the default for anything missing or unknown. */
export function parseSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    siblingOrder: SIBLING_ORDERS.includes(stored.siblingOrder as SiblingOrder)
      ? (stored.siblingOrder as SiblingOrder)
      : DEFAULT_SETTINGS.siblingOrder,
  }
}
