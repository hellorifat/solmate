import { useRef, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/utils'

/** Zoom on scroll: the block grows from slightly inset to full size as it reaches the middle of the screen. */
export function ZoomOnScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center 55%'] })
  const scale = useTransform(scrollYProgress, [0, 1], [reduced ? 1 : 0.86, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [reduced ? 1 : 0.35, 1])
  const y = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 60, 0])
  return (
    <motion.div ref={ref} style={{ scale, opacity, y }} className={cn('origin-center will-change-transform', className)}>
      {children}
    </motion.div>
  )
}

/** Parallax: decorative planet discs that drift slower or faster than the page. Purely visual. */
export function ParallaxWorlds({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const slow = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [120, -120])
  const fast = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [260, -260])
  const spin = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-20, 20])
  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <motion.div
        style={{ y: slow, rotate: spin, backgroundImage: `url(${asset('media/mars-2k.webp')})` }}
        className="absolute -right-24 top-10 size-72 rounded-full bg-cover bg-center opacity-25 shadow-[inset_-40px_-20px_80px_rgb(5_8_13/0.95)] blur-[1px] md:size-96"
      />
      <motion.div
        style={{ y: fast, backgroundImage: `url(${asset('media/moon-2k.webp')})` }}
        className="absolute -left-16 bottom-0 size-40 rounded-full bg-cover bg-center opacity-20 shadow-[inset_-24px_-12px_48px_rgb(5_8_13/0.95)] md:size-56"
      />
    </div>
  )
}

/** Scroll-linked text: each word lights up as the paragraph moves through the viewport. */
export function ScrollRevealText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] })
  const words = text.split(' ')
  return (
    <p ref={ref} className={cn('flex flex-wrap gap-x-[0.28em]', className)}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} reduced={!!reduced}>
          {w}
        </Word>
      ))}
    </p>
  )
}

function Word({ children, progress, range, reduced }: { children: string; progress: MotionValue<number>; range: [number, number]; reduced: boolean }) {
  const opacity = useTransform(progress, range, [reduced ? 1 : 0.14, 1])
  return <motion.span style={{ opacity }}>{children}</motion.span>
}

/** Stacking cards: each card pins under the previous one and the earlier cards recede as you scroll. */
export function StackCards({ items }: { items: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  return (
    <div ref={ref} className="relative">
      {items.map((item, i) => (
        <StackCard key={i} i={i} n={items.length} progress={scrollYProgress}>
          {item}
        </StackCard>
      ))}
    </div>
  )
}

function StackCard({ i, n, progress, children }: { i: number; n: number; progress: MotionValue<number>; children: ReactNode }) {
  const reduced = useReducedMotion()
  const scale = useTransform(progress, [i / n, 1], [1, reduced ? 1 : 1 - (n - 1 - i) * 0.05])
  const dim = useTransform(progress, [i / n, 1], [1, reduced ? 1 : 1 - (n - 1 - i) * 0.25])
  return (
    <div className="sticky flex h-[70svh] items-start justify-center pt-4" style={{ top: `calc(5rem + ${i * 1.5}rem)` }}>
      <motion.div style={{ scale, opacity: dim }} className="w-full origin-top">
        {children}
      </motion.div>
    </div>
  )
}

/** Tilts toward the pointer with a soft glare; flat on touch and under reduced motion. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const rx = useSpring(0, { stiffness: 200, damping: 20 })
  const ry = useSpring(0, { stiffness: 200, damping: 20 })
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const glare = useMotionTemplate`radial-gradient(400px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.07), transparent 45%)`
  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={cn('relative', className)}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        ry.set((px - 0.5) * 10)
        rx.set(-(py - 0.5) * 10)
        gx.set(px * 100)
        gy.set(py * 100)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glare }} />
    </motion.div>
  )
}
