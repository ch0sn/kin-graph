import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { PersonId } from '../model'
import {
  EMPTY_MENU_STATE,
  NO_ACTIONS,
  NodeMenuApiContext,
  NodeMenuStateContext,
  sameMenu,
  type NodeMenuAction,
} from './useNodeMenu'

/**
 * Holds the open toolbox. The sheet publishes actions; the selected person's
 * card draws them. Split into two contexts so publishing a fresh click
 * handler does not re-render every card.
 */
export function NodeMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ personId: PersonId; actions: NodeMenuAction[] } | null>(null)
  const latest = useRef<NodeMenuAction[]>(NO_ACTIONS)

  const api = useMemo(
    () => ({
      publish(personId: PersonId, actions: NodeMenuAction[]) {
        latest.current = actions
        setMenu((cur) => {
          if (cur?.personId === personId && sameMenu(cur.actions, actions)) return cur
          return { personId, actions }
        })
      },
      clear(personId: PersonId) {
        setMenu((cur) => (cur?.personId === personId ? null : cur))
      },
      invoke(id: string) {
        const action = latest.current.find((item) => item.id === id)
        if (action?.available) action.onClick()
      },
    }),
    [],
  )

  const state = useMemo(
    () => (menu ? { personId: menu.personId, actions: menu.actions } : EMPTY_MENU_STATE),
    [menu],
  )

  return (
    <NodeMenuApiContext.Provider value={api}>
      <NodeMenuStateContext.Provider value={state}>{children}</NodeMenuStateContext.Provider>
    </NodeMenuApiContext.Provider>
  )
}
