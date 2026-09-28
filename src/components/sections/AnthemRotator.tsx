"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through the anthem endings ("for your health.", …).
 * Only the active line is rendered, re-keyed so it animates in; an invisible copy of the longest
 * line reserves the space, so nothing overlaps and the layout never jumps. Holds still for reduced motion.
 */
export function AnthemRotator({ lines, intervalMs = 2200 }: { lines: readonly string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), intervalMs);
    return () => window.clearInterval(id);
  }, [lines.length, intervalMs]);

  return (
    <span className="relative inline-grid" aria-hidden="true">
      <span className="invisible col-start-1 row-start-1">{longest}</span>
      <span key={index} className="col-start-1 row-start-1 animate-rise">
        {lines[index]}
      </span>
    </span>
  );
}
