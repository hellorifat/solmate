import { motion, useReducedMotion } from 'motion/react'
import { fadeUp, stagger } from '@/design/motion'

export function PageHeader({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.header variants={stagger(0.08)} initial="hidden" animate="show" className="mx-auto w-full max-w-4xl px-6 pb-10 pt-16 md:pt-24">
      <motion.p variants={fadeUp(reduced)} className="label-mono">
        {kicker}
      </motion.p>
      <motion.h1 variants={fadeUp(reduced)} className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
        {title}
      </motion.h1>
      {lead && (
        <motion.p variants={fadeUp(reduced)} className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-slate-300">
          {lead}
        </motion.p>
      )}
    </motion.header>
  )
}
