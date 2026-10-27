import { createContext } from 'react'

/**
 * Where a form's Cancel and Save go: a place in the sticky header above it,
 * so they stay in reach while scrolling. Undefined when there's no such
 * header, and null while it's still being laid out.
 */
export const FormActionsSlot = createContext<HTMLElement | null | undefined>(undefined)
