"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface NavItem {
  id: string;
  label: string;
  index: string;
}

/** A section counts as current once its top passes this share of the viewport height. */
const LINE = 0.4;

/**
 * Points-of-interest navigator for the long home page. Reads the sections tagged by <Section>
 * (data-nav / data-nav-index), so it follows the page as sections are added or reordered.
 * Wide screens: a tick rail on the right edge, labels on hover or keyboard focus.
 * Smaller screens: a floating "07 / 27" button that opens the list. Hidden while in the hero.
 */
export function SectionNav({ label, open: openLabel }: { label: string; open: string }) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [active, setActive] = useState(-1);
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("main section[data-nav]")];
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * LINE;
      let current = -1;
      sections.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= line) current = i;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // First read right after mount (a timer, not a frame: frames don't run in background tabs).
    const init = window.setTimeout(() => {
      setItems(sections.map((s) => ({ id: s.id, label: s.dataset.nav ?? "", index: s.dataset.navIndex ?? "" })));
      update();
    }, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(init);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    const onDown = (e: PointerEvent) => {
      if (!sheetRef.current?.contains(e.target as Node)) setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    // Keep the current section in view inside the list.
    sheetRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "center" });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [sheet]);

  if (!items.length) return null;
  const hidden = active < 0;
  const counter = `${String(Math.max(active, 0) + 1).padStart(2, "0")} / ${items.length}`;

  return (
    <>
      {/* Wide screens: tick rail */}
      <nav
        aria-label={label}
        className={cn(
          "group fixed top-1/2 right-3 z-40 hidden -translate-y-1/2 transition-opacity duration-300 xl:block",
          hidden && "pointer-events-none opacity-0",
        )}
      >
        <ol className="rounded-2xl border border-transparent py-2 pr-1 pl-2 transition-colors group-focus-within:border-line group-focus-within:bg-night/90 group-focus-within:backdrop-blur-xl group-hover:border-line group-hover:bg-night/90 group-hover:backdrop-blur-xl">
          {items.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={i === active ? "true" : undefined}
                className="flex h-[15px] items-center justify-end gap-2.5 outline-offset-0"
              >
                <span
                  className={cn(
                    "max-w-0 overflow-hidden font-mono text-[10px] tracking-[0.12em] whitespace-nowrap uppercase opacity-0 transition-all duration-200 group-focus-within:max-w-56 group-focus-within:opacity-100 group-hover:max-w-56 group-hover:opacity-100",
                    i === active ? "text-text" : "text-faint hover:text-text",
                  )}
                >
                  {item.index && <span className="text-pulse-fg">{item.index} </span>}
                  {item.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-[3px] shrink-0 rounded-full transition-all duration-200",
                    i === active ? "w-6 bg-pulse" : "w-3 bg-faint/50 group-hover:bg-faint",
                  )}
                />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Smaller screens: floating button + list */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed right-4 bottom-4 z-40 transition-opacity duration-300 xl:hidden",
          hidden && !sheet && "pointer-events-none opacity-0",
        )}
      >
        {sheet && (
          <nav
            aria-label={label}
            className="absolute right-0 bottom-14 max-h-[65dvh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-night/95 p-2 shadow-2xl backdrop-blur-xl"
          >
            <ol>
              {items.map((item, i) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setSheet(false)}
                    aria-current={i === active ? "true" : undefined}
                    className={cn(
                      "flex gap-2.5 rounded-lg px-3 py-2 text-sm",
                      i === active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface hover:text-text",
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono text-xs leading-5 text-pulse-fg">{item.index}</span>
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <button
          type="button"
          onClick={() => setSheet((v) => !v)}
          aria-expanded={sheet}
          aria-label={`${openLabel} · ${counter}`}
          className="flex h-11 items-center gap-2 rounded-full border border-line bg-night/90 px-4 font-mono text-xs tracking-[0.1em] text-text shadow-xl backdrop-blur-xl"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-pulse-fg" fill="currentColor" aria-hidden="true">
            <rect x="1" y="2" width="14" height="2" rx="1" />
            <rect x="1" y="7" width="10" height="2" rx="1" />
            <rect x="1" y="12" width="6" height="2" rx="1" />
          </svg>
          {counter}
        </button>
      </div>
    </>
  );
}
