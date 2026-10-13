import { Mountain, Radar, Satellite } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layer } from '@/hooks/useExplorerState'
import { cn } from '@/lib/utils'
import { ROLE } from './roles'

interface ToggleProps {
  layer: Layer
  onChange: (l: Layer) => void
  screening: boolean
  onScreening?: (on: boolean) => void
}

export function LayerToggle({ layer, onChange, screening, onScreening }: ToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup type="single" value={layer} onValueChange={(v) => v && onChange(v as Layer)} className="surface rounded-full p-1" aria-label="Map layer">
        <ToggleGroupItem value="imagery" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
          <Satellite className="size-3.5" /> Imagery
        </ToggleGroupItem>
        <ToggleGroupItem value="terrain" className="h-8 gap-1.5 rounded-full px-3 text-xs data-[state=on]:bg-slate-100 data-[state=on]:text-ink-900">
          <Mountain className="size-3.5" /> 3D terrain
        </ToggleGroupItem>
      </ToggleGroup>
      {onScreening && (
        <button
          type="button"
          aria-pressed={screening}
          onClick={() => onScreening(!screening)}
          className={cn(
            'surface inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs transition-colors',
            screening ? 'text-screen' : 'text-slate-300 hover:text-slate-100',
          )}
        >
          <Radar className="size-3.5" /> <span className="max-sm:sr-only">Screening</span>
        </button>
      )}
    </div>
  )
}

export function MapLegend({ screening = false }: { screening?: boolean }) {
  return (
    <div className="surface flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-full px-4 py-2 text-[11px] text-slate-300">
      {(['documented', 'candidate', 'control'] as const).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2" style={{ borderColor: ROLE[r].color, borderStyle: r === 'control' ? 'dashed' : 'solid' }} aria-hidden="true" />
          {ROLE[r].short}
        </span>
      ))}
      {screening && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-10 rounded-full bg-[linear-gradient(90deg,#2c3d56,#7d6a8e,#e7a1c9,#fff2fa)]" aria-hidden="true" />
          Screened (low → high)
        </span>
      )}
      <span className="hidden text-slate-400 xl:inline">· number = rank · dashed square = 20 km window</span>
    </div>
  )
}
