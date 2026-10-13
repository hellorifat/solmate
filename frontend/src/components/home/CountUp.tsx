import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'

/** Counts up to `value` the first time it scrolls into view (instant under reduced motion). */
export function CountUp({ value, decimals = 0, duration = 1.2 }: { value: number; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setShown })
    return () => controls.stop()
  }, [inView, reduced, value, duration])

  return (
    <span ref={ref} className="tabular">
      {(reduced ? value : shown).toFixed(decimals)}
    </span>
  )
}
