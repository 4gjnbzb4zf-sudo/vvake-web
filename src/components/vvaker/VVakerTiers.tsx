import type { Dictionary } from "@/i18n/dictionaries";

const STYLES = [
  { border: "border-line", accent: "text-text", mark: "✓" },
  { border: "border-volt/40", accent: "text-volt", mark: "★" },
  { border: "border-pulse/50", accent: "text-pulse", mark: "✦" },
] as const;

/** Free forever / Earned by moving / Collector (paid): paid layers are cosmetic only (ADR-0002). */
export function VVakerTiers({ dict }: { dict: Dictionary["vvaker"]["tiers"] }) {
  return (
    <div className="mt-14">
      <h3 className="font-display text-2xl font-semibold sm:text-3xl">{dict.title}</h3>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {dict.columns.map((col, i) => {
          const s = STYLES[i % STYLES.length]!;
          return (
            <div key={col.name} className={`rounded-3xl border ${s.border} bg-surface/60 p-6`}>
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
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-faint">{dict.note}</p>
    </div>
  );
}
