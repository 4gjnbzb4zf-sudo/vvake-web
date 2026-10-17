"use client";

import { useEffect, useState } from "react";

/** The wall clock for rendering, refreshed every `everyMs` (renders stay pure: no Date.now() in a render). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
