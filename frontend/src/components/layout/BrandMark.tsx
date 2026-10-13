import { cn } from '@/lib/utils'

// Orbit-ring mark used across the film and the app.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.6" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" transform="rotate(-24 12 12)" />
        <circle cx="12" cy="12" r="2.6" fill="var(--data)" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">SolMate</span>
    </span>
  )
}
