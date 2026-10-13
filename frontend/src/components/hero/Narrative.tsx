import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface Props {
  body: 'mars' | 'moon'
  place: string
  best?: { name: string; score: number }
  curated: number
  screened: number
  reduced: boolean
}

const WHY: Record<Props['body'], string> = {
  mars: 'where NASA’s Perseverance rover landed',
  moon: 'a candidate Artemis III landing region',
}

/**
 * One-line story that explains the 3D scene as it plays: the target, the comparison, the result.
 * Restarts whenever the target changes.
 */
export function Narrative({ body, place, best, curated, screened, reduced }: Props) {
  const [phase, setPhase] = useState(reduced ? 2 : 0)
  useEffect(() => {
    if (reduced) return
    const a = setTimeout(() => setPhase(1), 50)
    const b = setTimeout(() => setPhase(2), 1900)
    const c = setTimeout(() => setPhase(3), 3800)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
      clearTimeout(c)
    }
  }, [body, reduced])
  const shown = reduced ? 3 : phase
  const world = body === 'mars' ? 'Mars' : 'the Moon'

  const lines = [
    null,
    <>
      <b className="font-medium text-slate-100">{place}</b> on {world}, {WHY[body]}.
    </>,
    <>
      Comparing its terrain with {curated} Earth sites{screened ? ` and ${screened} unexplored places` : ''}…
    </>,
    best ? (
      <>
        Best Earth match: <b className="font-medium text-slate-100">{best.name}</b>, <span className="tabular text-data">{Math.round(best.score * 100)}/100</span>. Arcs
        link the top 5.
      </>
    ) : (
      <>Loading the matches…</>
    ),
  ]

  return (
    <div className="relative flex min-h-[2.5rem] items-center gap-2.5 overflow-hidden" aria-live="polite">
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-data opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-data" />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${body}-${shown}`}
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
          transition={{ duration: 0.35 }}
          className="text-pretty text-[13px] leading-snug text-slate-300"
        >
          {lines[Math.max(1, shown)]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
