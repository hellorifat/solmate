import { Link } from 'react-router'
import { BrandMark } from './BrandMark'
import { TEAM_URL } from './NavBar'

export function Footer() {
  return (
    <footer className="border-t border-border bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-3">
          <BrandMark className="text-slate-100" />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            A research prototype for screening Earth locations against a selected planetary target. Built by Team Northern Lights for the
            NASA International Space Apps Challenge 2026.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="label-mono">Prototype</p>
          <ul className="space-y-2 text-slate-300">
            <li><Link className="hover:text-slate-100" to="/explorer">Explorer</Link></li>
            <li><Link className="hover:text-slate-100" to="/method">Method and validation</Link></li>
            <li><Link className="hover:text-slate-100" to="/provenance">Data provenance</Link></li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="label-mono">Team</p>
          <ul className="space-y-2 text-slate-300">
            <li><a className="hover:text-slate-100" href={TEAM_URL} target="_blank" rel="noreferrer">Team page</a></li>
            <li><a className="hover:text-slate-100" href="https://github.com/hellorifat/solmate" target="_blank" rel="noreferrer">Source on GitHub</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-5 text-center font-mono text-[11px] text-slate-400">
        Planetary data: NASA / USGS. Earth elevation: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
        2014-2018, provided under COPERNICUS by the European Union and ESA. Globe textures: NASA Blue Marble, USGS/NASA Ames Viking MDIM 2.1 colour mosaic, NASA LRO LROC WAC mosaic (via Moon Trek).
      </div>
    </footer>
  )
}
