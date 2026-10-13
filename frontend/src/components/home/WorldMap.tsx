import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SiteResult } from "@/science/analysis";
import { asset } from "@/lib/asset";
import { pct } from "@/lib/format";
import { ROLE } from "@/components/explorer/roles";

const x = (lon: number) => `${((lon + 180) / 360) * 100}%`;
const y = (lat: number) => `${((90 - lat) / 180) * 100}%`;

/**
 * Lightweight world overview (no WebGL): curated sites sized by similarity, screened windows as a heat layer.
 * Click any point to open it in the explorer.
 */
export function WorldMap({
  targetId,
  results,
  screened,
}: {
  targetId: string;
  results: SiteResult[];
  screened: SiteResult[];
}) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<SiteResult | null>(null);
  const maxScreened = useMemo(
    () => Math.max(...screened.map((s) => s.score), 0.01),
    [screened],
  );
  const open = (id: string, tab?: string) =>
    navigate(
      `/explorer?${new URLSearchParams({ ...(targetId !== "jezero" && { target: targetId }), site: id, ...(tab && { tab }) })}`,
    );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-ink-950">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="relative aspect-[2/1] w-full min-w-[720px]">
          <img
            src={asset("media/earth-2k.webp")}
            srcSet={`${asset("media/earth-1k.webp")} 1024w, ${asset("media/earth-2k.webp")} 2048w`}
            sizes="(min-width: 1024px) 1100px, 100vw"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70 saturate-[0.8]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(5_8_13/0.7))]" />
          {/* graticule */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 360 180"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {[-120, -60, 0, 60, 120].map((l) => (
              <line
                key={`m${l}`}
                x1={l + 180}
                x2={l + 180}
                y1={0}
                y2={180}
                stroke="rgb(127 216 230 / 0.08)"
                strokeWidth={0.3}
              />
            ))}
            {[-60, -30, 0, 30, 60].map((l) => (
              <line
                key={`p${l}`}
                y1={90 - l}
                y2={90 - l}
                x1={0}
                x2={360}
                stroke="rgb(127 216 230 / 0.08)"
                strokeWidth={0.3}
              />
            ))}
          </svg>

          {screened.map((s) => (
            <button
              key={s.site.id}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onClick={() => open(s.site.id, "screened")}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150"
              style={{
                left: x(s.site.lon),
                top: y(s.site.lat),
                width: 4 + 6 * (s.score / maxScreened),
                height: 4 + 6 * (s.score / maxScreened),
                background: `color-mix(in oklab, var(--screen) ${Math.round(30 + 70 * (s.score / maxScreened))}%, var(--ink-600))`,
                opacity: 0.35 + 0.65 * (s.score / maxScreened),
              }}
            />
          ))}

          {results.map((r, i) => (
            <motion.button
              key={r.site.id}
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: reduced ? 0 : 0.2 + i * 0.03,
                type: "spring",
                stiffness: 400,
                damping: 22,
              }}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r)}
              onBlur={() => setHover(null)}
              onClick={() => open(r.site.id)}
              aria-label={`${r.site.name}: rank ${r.rank}, similarity ${pct(r.score)}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: x(r.site.lon), top: y(r.site.lat) }}
            >
              <span
                className="block rounded-full border-2 bg-ink-950/70"
                style={{
                  width: 8 + 16 * r.score,
                  height: 8 + 16 * r.score,
                  borderColor: ROLE[r.site.role].color,
                  borderStyle: r.site.role === "control" ? "dashed" : "solid",
                  boxShadow:
                    r.rank <= 3
                      ? `0 0 0 4px color-mix(in oklab, ${ROLE[r.site.role].color} 25%, transparent)`
                      : undefined,
                }}
              />
              {r.rank <= 3 && !reduced && (
                <span
                  className="absolute inset-0 animate-ping rounded-full border"
                  style={{ borderColor: ROLE[r.site.role].color }}
                />
              )}
            </motion.button>
          ))}

          <AnimatePresence>
            {hover && (
              <motion.div
                key={hover.site.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-border bg-ink-900/95 p-3 shadow-xl"
                style={{
                  left: `clamp(7rem, ${x(hover.site.lon)}, calc(100% - 7rem))`,
                  // flip above the point in the southern half so the card never leaves the map
                  ...(hover.site.lat < 0
                    ? { bottom: `calc(${y(-hover.site.lat)} + 18px)` }
                    : { top: `calc(${y(hover.site.lat)} + 18px)` }),
                }}
              >
                <p
                  className="font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: ROLE[hover.site.role].color }}
                >
                  {ROLE[hover.site.role].short} · rank {hover.rank}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-slate-100">
                  {hover.site.name}
                </p>
                <p className="mt-1 text-xl tabular text-slate-100">
                  {pct(hover.score)}
                  <span className="text-xs text-slate-400">
                    {" "}
                    /100 similarity
                  </span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[11px] text-slate-400">
        {(["documented", "candidate", "control", "screened"] as const).map(
          (r) => (
            <span key={r} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full border-2"
                style={{
                  borderColor: ROLE[r].color,
                  background: r === "screened" ? ROLE[r].color : undefined,
                  borderStyle: r === "control" ? "dashed" : "solid",
                }}
              />
              {ROLE[r].short}
            </span>
          ),
        )}
        <span>· size = similarity · click a point to open it</span>
        <span className="md:hidden">· swipe to pan</span>
      </div>
    </div>
  );
}
