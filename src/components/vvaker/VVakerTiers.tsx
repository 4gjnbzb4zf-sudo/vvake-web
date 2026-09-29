import type { Dictionary } from "@/i18n/dictionaries";

const STYLES = [
  { border: "border-line", accent: "text-text", mark: "✓" },
  { border: "border-volt-fg/40", accent: "text-volt-fg", mark: "★" },
  { border: "border-pulse-fg/50", accent: "text-pulse-fg", mark: "✦" },
] as const;

/** Free forever / Earned by moving / Collector (paid): paid layers add utility, never an edge (ADR-0002, ADR-0012). */
export function VVakerTiers({ dict }: { dict: Dictionary["vvaker"]["tiers"] }) {
  return (
    <div className="mt-14">
      <h3 className="font-display text-2xl font-semibold sm:text-3xl">{dict.title}</h3>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {dict.columns.map((col, i) => {
          const s = STYLES[i % STYLES.length]!;
          return (
            <div
              key={col.name}
              className={`flex flex-col rounded-3xl border ${s.border} p-6 ${i === 2 ? "bg-gradient-to-b from-pulse/15 to-surface/60 shadow-[0_18px_50px_-24px_rgb(255_61_110/0.6)]" : "bg-surface/60"}`}
            >
              <p className={`font-display text-lg font-semibold ${s.accent}`}>{col.name}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden="true" className={`font-mono ${s.accent}`}>
                      {s.mark}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {i === 2 && (
                <a
                  href="#collector"
                  className="mt-auto inline-flex pt-5 font-display text-sm font-semibold text-pulse-fg hover:text-pulse-soft-fg"
                >
                  {dict.cta} ↓
                </a>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-faint">{dict.note}</p>
    </div>
  );
}
