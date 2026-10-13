import type { CandidateRole } from '@/science/analysis'

export const ROLE: Record<CandidateRole, { label: string; short: string; color: string; description: string }> = {
  documented: {
    label: 'NASA-documented analog',
    short: 'Documented',
    color: 'var(--data)',
    description: 'Earth field site featured in NASA’s Planetary Analog Explorer.',
  },
  candidate: {
    label: 'Literature candidate',
    short: 'Candidate',
    color: 'var(--derived)',
    description: 'Well-known analog site from the scientific literature, ranked but not used to score validation.',
  },
  control: {
    label: 'Negative control',
    short: 'Control',
    color: 'var(--slate-400)',
    description: 'Terrain with no planetary-analog use. The method should rank these low.',
  },
  screened: {
    label: 'Screened candidate · unreviewed',
    short: 'Screened',
    color: 'var(--screen)',
    description: 'A 20 km window from the regional screening. Terrain similarity only; needs expert and field review.',
  },
}

export const BODY = {
  mars: { label: 'Mars', color: 'var(--mars)' },
  moon: { label: 'Moon', color: 'var(--slate-200)' },
} as const

export const REFERENCE_COLOR = 'var(--reference)'
