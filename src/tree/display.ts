import { createContext, useContext } from 'react'

/** How the tree's cards are shown; shared through context so nodes needn't be rebuilt. */
export interface TreeDisplay {
  highlightGender: boolean
}

export const TreeDisplayContext = createContext<TreeDisplay>({ highlightGender: false })

export function useTreeDisplay(): TreeDisplay {
  return useContext(TreeDisplayContext)
}
