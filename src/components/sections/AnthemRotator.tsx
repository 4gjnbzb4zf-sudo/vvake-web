"use client";

import { useEffect, useState } from "react";

/** Cycles through the anthem endings ("for your health.", …). Holds still for reduced-motion users. */
export function AnthemRotator({ lines, intervalMs = 2200 }: { lines: readonly string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), intervalMs);
    return () => window.clearInterval(id);
  }, [lines.length, intervalMs]);

  return (
    <span className="relative inline-grid" aria-hidden="true">
      {/* The widest line reserves space so the layout never jumps. */}
      {lines.map((line, i) => (
        <span
          key={line}
          className={`col-start-1 row-start-1 transition-[opacity,translate] ease-out ${
            i === index ? "translate-y-0 opacity-100 delay-200 duration-300" : "pointer-events-none -translate-y-2 opacity-0 duration-200"
          }`}
        >
          {line}
        </span>
      ))}
    </span>
  );
}
