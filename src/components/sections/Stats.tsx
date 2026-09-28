"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";
import { CITIES, RIVALRIES } from "@/lib/cities";

/** The first two facts come from the city data, so the band can never drift from the launch list. */
const LIVE_COUNTS = [CITIES.size, RIVALRIES.length];

/** Counts from 0 to `value` once visible (instant under reduced motion). */
function useCountUp(value: number, start: boolean, durationMs = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.requestAnimationFrame(() => setN(value));
      return () => window.cancelAnimationFrame(id);
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, start, durationMs]);
  return n;
}

function Stat({ value, label, suffix, start }: { value: number; label: string; suffix?: string; start: boolean }) {
  const n = useCountUp(value, start);
  return (
    <div className="px-4 py-6 text-center">
      <p className="font-display text-5xl font-bold text-text italic sm:text-6xl">
        {n}
        {suffix}
      </p>
      <p className="mt-2 font-mono text-[0.7rem] tracking-[0.18em] text-volt uppercase">{label}</p>
    </div>
  );
}

/** STEPN-style counter band, but only with true launch facts (no fake usage numbers). */
export function Stats({ dict }: { dict: Dictionary["stats"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-label={dict.note} className="relative overflow-hidden border-b border-line/60 py-10">
      <div className="hazard pointer-events-none absolute top-6 -left-2 h-24 w-6" aria-hidden="true" />
      <div className="hazard pointer-events-none absolute -right-2 bottom-6 h-24 w-6" aria-hidden="true" />
      <Container>
        <div ref={ref} className="grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
          {dict.items
            .map((raw, i) => ({ ...raw, value: LIVE_COUNTS[i] ?? raw.value }))
            .map((item) => (
              <Stat
                key={item.label}
                value={item.value}
                label={item.label}
                suffix={"suffix" in item ? item.suffix : undefined}
                start={visible}
              />
            ))}
        </div>
        <p className="mt-2 text-center text-xs text-faint">{dict.note}</p>
      </Container>
    </section>
  );
}
