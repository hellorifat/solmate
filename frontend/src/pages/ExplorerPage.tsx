import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Columns2, ListOrdered, Radar, SlidersHorizontal } from 'lucide-react'
import { useAnalysisData } from '@/hooks/useAnalysisData'
import { useExplorerState } from '@/hooks/useExplorerState'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { analyse } from '@/science/analysis'
import { MapView } from '@/components/explorer/MapView'
import { RankList } from '@/components/explorer/RankList'
import { WeightPanel } from '@/components/explorer/WeightPanel'
import { SiteDetail } from '@/components/explorer/SiteDetail'
import { ReferenceCard } from '@/components/explorer/ReferenceCard'
import { EvidenceBadge } from '@/components/explorer/EvidenceBadge'
import { TargetSwitcher } from '@/components/explorer/TargetSwitcher'
import { ExportMenu } from '@/components/explorer/ExportMenu'
import { ComparePanel } from '@/components/explorer/ComparePanel'
import { LayerToggle, MapLegend } from '@/components/explorer/MapOverlays'
import { ErrorState, PanelSkeleton } from '@/components/common/States'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AnalysisData } from '@/data/load'
import type { SiteResult } from '@/science/analysis'

const EASE = [0.16, 1, 0.3, 1] as const

// The roughness group (r ≈ 0.98–1.00 across sites) shares one indicator's worth of weight.
const BALANCED: Record<string, number> = { slope_median: 0.35, local_relief: 0.35, ruggedness: 0.35, slope_p90: 1, hypsometric_integral: 1 }

export default function ExplorerPage() {
  const target = new URLSearchParams(window.location.search).get('target') ?? 'jezero'
  const state = useAnalysisData(target)
  if (state.status === 'error') {
    return <ErrorState title="The analysis data could not be loaded." detail={state.error.message} onRetry={state.retry} />
  }
  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-clip bg-ink-950">
      {state.status === 'loading' ? (
        <div className="surface absolute left-4 top-4 w-[360px] rounded-xl">
          <PanelSkeleton />
        </div>
      ) : (
        <Explorer initial={state.data} />
      )}
    </div>
  )
}

function Explorer({ initial }: { initial: AnalysisData }) {
  const reduced = useReducedMotion() ?? false
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useExplorerState(initial.indicators.profile.scored)
  // switching target loads that target's artifacts; the previous view stays until they arrive
  const live = useAnalysisData(ui.target)
  const data = live.status === 'ready' ? live.data : initial
  const { indicators: doc, validation } = data
  const [hovered, setHovered] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(() => ui.compare.length === 2) // deep links with two sites open the comparison
  // on short screens the sliders start folded so the ranking stays visible
  const [weightsOpen, setWeightsOpen] = useState(() => window.innerHeight >= 940)

  const analysis = useMemo(() => analyse(doc, ui.weights, data.screening), [doc, ui.weights, data.screening])
  const selected = ui.selected ? analysis.byId.get(ui.selected) ?? null : null
  const meta = doc.profile.indicators.filter((m) => doc.profile.scored.includes(m.id))
  const retrieval = validation.retrieval
  const comparePair = ui.compare.map((id) => analysis.byId.get(id)).filter((r): r is SiteResult => !!r)
  const showCompare = compareOpen && comparePair.length === 2
  const loadingTarget = live.status === 'loading'
  const isBalanced = Object.entries(BALANCED).every(([k, v]) => ui.weights[k] === v)

  const sensitivityRanks =
    selected && selected.site.role !== 'screened'
      ? validation.sensitivity
          .filter((c) => c.id !== 'primary')
          .map((c) => ({ label: c.cell_m === 200 ? 'At 200 m cells' : `In ${c.window_m / 1000} km window`, rank: c.ranks[selected.site.id] ?? 0 }))
      : []

  const select = (id: string | null) => {
    ui.select(id)
    setCompareOpen(false)
    setListOpen(false)
  }

  const panel = (
    <div className={cn('flex h-full flex-col transition-opacity', loadingTarget && 'opacity-60')}>
      <div className="space-y-4 border-b border-border p-4">
        <TargetSwitcher targets={data.targets.targets} value={doc.reference.id} onChange={ui.setTarget} />
        <ReferenceCard reference={doc.reference} />
        <Link to="/method#validation" className="block rounded-lg border border-border bg-ink-850 px-3 py-2.5 transition-colors hover:border-slate-300/30">
          <span className="label-mono">Method check · known-analog retrieval</span>
          <span className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-slate-200">NASA-documented {retrieval.pair} analogs vs controls</span>
            <span className="text-sm tabular text-positive">AUC {retrieval.auc_documented.toFixed(2)}</span>
          </span>
        </Link>
        <div>
          <button
            type="button"
            aria-expanded={weightsOpen}
            aria-controls="weights-panel"
            onClick={() => setWeightsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-[13px] text-slate-200 transition-colors hover:bg-ink-800"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-data" />
              Indicator weights
              <span className="font-mono text-[11px] text-slate-400">· {ui.isDefaultWeights ? 'equal' : isBalanced ? 'balanced' : 'custom'}</span>
            </span>
            <ChevronDown className={cn('size-4 text-slate-400 transition-transform', weightsOpen && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {weightsOpen && (
              <motion.div
                id="weights-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <WeightPanel
                    indicators={meta}
                    weights={ui.weights}
                    isDefault={ui.isDefaultWeights}
                    onChange={ui.setWeight}
                    onReset={ui.resetWeights}
                    onBalanced={() => ui.setAllWeights(BALANCED)}
                    isBalanced={isBalanced}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
        <Tabs value={ui.tab} onValueChange={(v) => ui.setTab(v as 'curated' | 'screened')}>
          <TabsList className="h-8">
            <TabsTrigger value="curated" className="px-2.5 text-xs">
              Known sites
            </TabsTrigger>
            <TabsTrigger value="screened" className="px-2.5 text-xs" disabled={!data.screening}>
              <Radar className="size-3.5" /> New candidates
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <ExportMenu doc={doc} analysis={analysis} weights={ui.weights} includeScreened={ui.tab === 'screened'} />
      </div>
      {ui.tab === 'screened' && data.screening && (
        <p className="px-4 pb-1 text-[11px] leading-relaxed text-slate-400">
          {data.screening.windows.length} windows screened in {data.screening.regions.length} arid, polar and volcanic regions. Unreviewed: terrain only.
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <RankList
          label={ui.tab === 'curated' ? `Earth sites ranked by terrain similarity to ${doc.reference.short}` : `Screened windows ranked by terrain similarity to ${doc.reference.short}`}
          results={ui.tab === 'curated' ? analysis.results : analysis.screened}
          limit={ui.tab === 'screened' ? 40 : undefined}
          selectedId={ui.selected}
          hoveredId={hovered}
          compare={ui.compare}
          rankRange={ui.tab === 'curated' ? validation.weight_perturbation.rank_range : undefined}
          onSelect={select}
          onHover={setHovered}
          onToggleCompare={(id) => {
            ui.toggleCompare(id)
            if (ui.compare.length === 1 && !ui.compare.includes(id)) setCompareOpen(true)
          }}
        />
      </ScrollArea>
      <AnimatePresence>
        {ui.compare.length > 0 && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className="flex items-center justify-between gap-2 border-t border-border bg-ink-850 px-4 py-2.5"
          >
            <span className="text-xs text-slate-300">{ui.compare.length === 1 ? 'Pick one more site to compare' : '2 sites selected'}</span>
            <span className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={ui.clearCompare} className="text-slate-400">
                Clear
              </Button>
              <Button size="xs" variant="data" disabled={comparePair.length < 2} onClick={() => setCompareOpen(true)}>
                <Columns2 /> Compare
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const detail = showCompare ? (
    <ComparePanel
      a={comparePair[0]!}
      b={comparePair[1]!}
      reference={doc.reference}
      referenceValues={analysis.reference}
      indicators={meta}
      onClose={() => setCompareOpen(false)}
      onRemove={(id) => ui.toggleCompare(id)}
    />
  ) : selected ? (
    <SiteDetail
      result={selected}
      reference={doc.reference}
      referenceValues={analysis.reference}
      indicators={meta}
      weights={ui.weights}
      rankRange={selected.site.role === 'screened' ? undefined : validation.weight_perturbation.rank_range[selected.site.id]}
      sensitivityRanks={sensitivityRanks}
      total={selected.site.role === 'screened' ? analysis.screened.length : analysis.results.length}
      onClose={() => select(null)}
      evidence={selected.site.role === 'screened' ? undefined : <EvidenceBadge result={data.claims?.results[selected.site.id]} doc={data.claims} />}
    />
  ) : null
  const detailKey = showCompare ? `cmp-${ui.compare.join()}` : selected?.site.id

  return (
    <>
      {isDesktop ? (
        <motion.aside
          initial={{ opacity: 0, x: reduced ? 0 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="surface absolute bottom-4 left-4 top-4 z-10 w-[360px] overflow-clip rounded-xl"
          aria-label="Analysis controls and ranking"
        >
          {panel}
        </motion.aside>
      ) : (
        <>
          <div className="absolute inset-x-3 bottom-3 z-20 flex justify-center">
            <Button onClick={() => setListOpen(true)} className="rounded-full shadow-lg">
              <ListOrdered /> Targets, weights and ranking
            </Button>
          </div>
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetContent side="bottom" className="h-[88dvh] border-border bg-ink-900 p-0 pt-8" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetTitle className="sr-only">Targets, weights and ranking</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* map comes after the panels in the DOM so keyboard focus reaches controls first; panels stay on top via z-index */}
      <MapView
        results={analysis.results}
        screened={analysis.screened}
        showScreened={ui.showScreening}
        selectedId={ui.selected}
        hoveredId={hovered}
        layer={ui.layer}
        onSelect={select}
        onHover={setHovered}
        reducedMotion={reduced}
        padding={isDesktop ? { left: 380, right: detail ? 440 : 0, top: 60, bottom: 40 } : { left: 0, right: 0, top: 60, bottom: 60 }}
      />

      <div
        className={cn(
          'pointer-events-none absolute top-4 z-10 flex justify-center transition-[right] duration-300',
          isDesktop ? cn('left-[392px]', selected || showCompare ? 'right-4 xl:right-[452px]' : 'right-4') : 'inset-x-3',
        )}
      >
        <div className="pointer-events-auto">
          <LayerToggle layer={ui.layer} onChange={ui.setLayer} screening={ui.showScreening} onScreening={data.screening ? ui.setShowScreening : undefined} />
        </div>
      </div>
      {isDesktop && (
        <div className={cn('pointer-events-none absolute bottom-4 left-[392px] z-10 flex justify-center transition-[right] duration-300', selected || showCompare ? 'right-16 xl:right-[452px]' : 'right-16')}>
          <div className="pointer-events-auto">
            <MapLegend screening={ui.showScreening} />
          </div>
        </div>
      )}

      {isDesktop ? (
        <AnimatePresence mode="wait">
          {detail && (
            <motion.aside
              key={detailKey}
              initial={{ opacity: 0, x: reduced ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : 24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="surface absolute bottom-4 right-4 top-4 z-20 w-[420px] overflow-clip rounded-xl"
            >
              {detail}
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <Sheet
          open={!!detail}
          onOpenChange={(o) => {
            if (o) return
            if (showCompare) setCompareOpen(false)
            else select(null)
          }}
        >
          <SheetContent side="bottom" className="h-[88dvh] border-border bg-ink-900 p-0 [&>button]:hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetTitle className="sr-only">{showCompare ? 'Compare sites' : selected?.site.name ?? 'Site details'}</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
