"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Adds `in-view` to its wrapper the first time it scrolls into view (for CSS-driven reveal animations). */
export function InView({ children, className, threshold = 0.3 }: { children: ReactNode; className?: string; threshold?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, visible]);

  return (
    <div ref={ref} className={[className, visible ? "in-view" : undefined].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
