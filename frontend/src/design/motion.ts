import type { Transition, Variants } from 'motion/react'

// Shared motion language: short, eased, never blocking. Components read `useReducedMotion()`
// and pass `reduced` so entrance offsets collapse to simple fades.
export const ease = [0.16, 1, 0.3, 1] as const

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }

export function fadeUp(reduced: boolean | null, delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.2 : 0.7, ease, delay } },
  }
}

export const stagger = (step = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
})
