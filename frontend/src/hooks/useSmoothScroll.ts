import { useEffect } from 'react'
import Lenis from 'lenis'

let instance: Lenis | null = null

/** Scroll to an element or offset, smoothly when Lenis is running. */
export function scrollToTarget(target: string | HTMLElement | number) {
  if (instance) instance.scrollTo(target, { offset: typeof target === 'number' ? 0 : -64, duration: 1.2 })
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' })
  else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Inertial wheel scrolling for content pages (Lenis). Touch keeps the platform's native momentum, which is
 * already smooth and is what people expect on phones. Off for reduced motion and for the map workspace,
 * where wheel gestures belong to the map.
 */
export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1, anchors: { offset: -64 }, autoRaf: true })
    instance = lenis
    return () => {
      lenis.destroy()
      if (instance === lenis) instance = null
    }
  }, [enabled])
}
