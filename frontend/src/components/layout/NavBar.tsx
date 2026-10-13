import { NavLink, Link } from 'react-router'
import { useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { ExternalLink } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { cn } from '@/lib/utils'
import { spring } from '@/design/motion'

const LINKS = [
  { to: '/explorer', label: 'Explorer' },
  { to: '/method', label: 'Method' },
  { to: '/provenance', label: 'Data' },
]

export const TEAM_URL = 'https://www.spaceappschallenge.org/2026/find-a-team/northern-lights3/'

export function NavBar({ overlay = false }: { overlay?: boolean }) {
  // Over the home hero the bar starts transparent and turns into frosted glass once the page scrolls.
  const { scrollY, scrollYProgress } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 })
  const glass = !overlay || scrolled

  return (
    <header
      className={cn(
        'z-40 flex h-16 items-center justify-between px-5 transition-[background-color,border-color,backdrop-filter] duration-500 md:px-8',
        overlay ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        glass ? 'border-b border-border bg-background/70 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      {overlay && (
        <motion.div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-reference via-data to-screen" style={{ scaleX: progress }} />
      )}
      <Link to="/" className="rounded-md text-slate-100" aria-label="SolMate home">
        <BrandMark />
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-1">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn(
                'relative rounded-md px-3 py-2 text-sm transition-colors',
                isActive ? 'text-slate-100' : 'text-slate-300 hover:text-slate-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                {l.label}
                {isActive && (
                  <motion.span layoutId="nav-active" transition={spring} className="absolute inset-x-3 -bottom-px h-px bg-data" />
                )}
              </>
            )}
          </NavLink>
        ))}
        <a
          href={TEAM_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-2 hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-300/40 hover:text-slate-100 sm:inline-flex"
        >
          Team Northern Lights <ExternalLink className="size-3" />
        </a>
      </nav>
    </header>
  )
}
