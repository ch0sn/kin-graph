import type { LucideIcon } from 'lucide-react'
import { createContext, useContext } from 'react'
import type { PersonId } from '../model'

/** One toolbox action drawn as a disc on the fan. */
export interface NodeMenuAction {
  id: string
  label: string
  Icon: LucideIcon
  available: boolean
  tone?: 'default' | 'danger'
  /** Hover and screen-reader text. Longer than `label` when the action can't be used. */
  title: string
  onClick: () => void
}

export interface NodeMenuApi {
  publish: (personId: PersonId, actions: NodeMenuAction[]) => void
  clear: (personId: PersonId) => void
  invoke: (id: string) => void
}

export interface NodeMenuState {
  personId: PersonId | null
  actions: NodeMenuAction[]
}

export const NO_ACTIONS: NodeMenuAction[] = []
export const EMPTY_MENU_STATE: NodeMenuState = { personId: null, actions: NO_ACTIONS }

export const NodeMenuApiContext = createContext<NodeMenuApi | null>(null)
export const NodeMenuStateContext = createContext<NodeMenuState>(EMPTY_MENU_STATE)

export function sameMenu(a: NodeMenuAction[], b: NodeMenuAction[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (action, i) =>
        action.id === b[i].id &&
        action.label === b[i].label &&
        action.available === b[i].available &&
        action.tone === b[i].tone &&
        action.title === b[i].title &&
        action.Icon === b[i].Icon,
    )
  )
}

export function useNodeMenuApi(): NodeMenuApi | null {
  return useContext(NodeMenuApiContext)
}

export function useNodeMenuState(): NodeMenuState {
  return useContext(NodeMenuStateContext)
}
