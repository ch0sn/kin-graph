import type { Variants } from 'motion/react'

/**
 * Page transition. `direction` 1 enters from the right and the current page
 * leaves to the left; -1 does the opposite.
 */
export const slideVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.22, ease: 'easeOut' },
  }),
}

/** Staggers the fields of one step. The parent sets `initial` and `animate`. */
export const staggerVariants: Variants = {
  enter: {},
  center: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

export const fieldVariants: Variants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}
