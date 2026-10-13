import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
import { AppShell } from '@/components/layout/AppShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import HomePage from '@/pages/HomePage'

const ExplorerPage = lazy(() => import('@/pages/ExplorerPage'))
const MethodPage = lazy(() => import('@/pages/MethodPage'))
const DataPage = lazy(() => import('@/pages/DataPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// GitHub Pages serves the app from /solmate/; BASE_URL carries that prefix (with a trailing slash).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <BrowserRouter basename={basename}>
          <Suspense fallback={<div className="flex-1" />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="explorer" element={<ExplorerPage />} />
                <Route path="method" element={<MethodPage />} />
                <Route path="provenance" element={<DataPage />} />
                <Route path="data" element={<Navigate to="/provenance" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
