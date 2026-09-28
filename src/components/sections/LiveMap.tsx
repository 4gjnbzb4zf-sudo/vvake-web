"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { demoActivity, liveSnapshotSchema, visibleCount } from "@/lib/live";

export interface MapCity {
  slug: string;
  name: string;
  x: number;
  y: number;
  metroPopulation: number;
  lon: number;
}

interface LiveMapProps {
  dict: Dictionary["live"];
  dots: readonly { x: number; y: number }[];
  cities: readonly MapCity[];
  width: number;
  height: number;
  endpoint: string;
  numberLocale: string;
}

/** Voxel world map with pulsing city activity. Live feed when configured, otherwise a labelled demo. */
export function LiveMap({ dict, dots, cities, width, height, endpoint, numberLocale }: LiveMapProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLive, setIsLive] = useState(false);
  const nf = useMemo(() => new Intl.NumberFormat(numberLocale), [numberLocale]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (endpoint) {
        try {
          const res = await fetch(`${endpoint}/live`, { headers: { accept: "application/json" } });
          const parsed = liveSnapshotSchema.safeParse(await res.json());
          if (!cancelled && res.ok && parsed.success) {
            setCounts(Object.fromEntries(parsed.data.cities.map((c) => [c.slug, visibleCount(c.active)])));
            setIsLive(true);
            return;
          }
        } catch {
          // fall through to demo
        }
      }
      if (cancelled) return;
      const now = Date.now();
      setCounts(Object.fromEntries(cities.map((c, i) => [c.slug, visibleCount(demoActivity(c.metroPopulation, c.lon, now, i + 1))])));
      setIsLive(false);
    }
    void tick();
    const id = window.setInterval(tick, endpoint ? 15_000 : 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [endpoint, cities]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = [...cities]
    .map((c) => ({ ...c, n: counts[c.slug] ?? 0 }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_280px]">
      <div className="relative overflow-hidden rounded-[2rem] border border-line bg-night-2 p-3 sm:p-5">
        <span
          className={`absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-[0.14em] uppercase ${
            isLive ? "border-down/50 bg-down/15 text-down" : "border-line bg-night text-faint"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse-glow bg-down" : "bg-faint"}`} />
          {isLive ? dict.liveLabel : dict.demo}
        </span>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${dict.title} ${dict.now}: ${nf.format(total)}`}
        >
          <g fill="#262a2f">
            {dots.map((d) => (
              <rect key={`${d.x}-${d.y}`} x={d.x - 3} y={d.y - 3} width={6} height={6} rx={1.2} />
            ))}
          </g>
          {cities.map((c) => {
            const n = counts[c.slug] ?? 0;
            if (n === 0) return null;
            const r = 3 + 9 * Math.sqrt(n / max);
            return (
              <g key={c.slug}>
                <circle cx={c.x} cy={c.y} r={r * 2.2} fill="#ff3d6e" opacity={0.12} className="animate-pulse-glow" />
                <circle cx={c.x} cy={c.y} r={r} fill="#ff3d6e" opacity={0.85} />
                <circle cx={c.x} cy={c.y} r={Math.max(1.5, r / 3)} fill="#ccff00" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-3">
        <div className="rounded-3xl border border-line bg-surface/70 p-5">
          <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.now}</p>
          <p className="mt-1 font-display text-4xl font-bold text-pulse tabular-nums">{nf.format(total)}</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface/70 p-5">
          <p className="font-mono text-[0.7rem] tracking-[0.16em] text-faint uppercase">{dict.top}</p>
          <ol className="mt-3 space-y-2">
            {top.map((c, i) => (
              <li key={c.slug} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>
                  {c.name}
                </span>
                <span className="font-mono text-xs text-volt tabular-nums">{nf.format(c.n)}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs leading-relaxed text-faint">🔒 {dict.privacy}</p>
      </div>
    </div>
  );
}
