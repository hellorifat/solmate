import { Outlet, useLocation } from 'react-router'
import { useEffect } from 'react'
import { NavBar } from './NavBar'
import { Footer } from './Footer'
import { scrollToTarget, useSmoothScroll } from '@/hooks/useSmoothScroll'

// Page frame. The home page overlays the nav on the hero; the explorer is a full-height workspace without a footer.
export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isWorkspace = pathname.startsWith('/explorer')

  useSmoothScroll(!isWorkspace)

  useEffect(() => {
    if (!isWorkspace) {
      window.scrollTo({ top: 0 })
      scrollToTarget(0)
    }
  }, [pathname, isWorkspace])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-100 focus:px-3 focus:py-2 focus:text-ink-900">
        Skip to content
      </a>
      <NavBar overlay={isHome} />
      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {!isWorkspace && <Footer />}
    </div>
  )
}
