import { createContext, useContext } from 'react'
import type { PersonId } from '../model'

/** How the tree's cards are shown; shared through context so nodes needn't be rebuilt. */
export interface TreeDisplay {
  highlightGender: boolean
  /** People the tree check found something about, marked on their cards. */
  flagged: ReadonlySet<PersonId>
}

export const TreeDisplayContext = createContext<TreeDisplay>({ highlightGender: false, flagged: new Set() })

export function useTreeDisplay(): TreeDisplay {
  return useContext(TreeDisplayContext)
}
