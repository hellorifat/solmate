import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <AlertTriangle className="size-6 text-negative" />
      <div>
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-1 font-mono text-xs text-slate-400">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  )
}

export function PanelSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading analysis">
      <Skeleton className="h-24 w-full bg-ink-700" />
      <Skeleton className="h-4 w-1/3 bg-ink-700" />
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full bg-ink-800" />
      ))}
    </div>
  )
}
