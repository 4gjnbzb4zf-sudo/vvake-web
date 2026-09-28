import type { ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

const ICONS: readonly ReactNode[] = [
  // energy bar
  <svg key="energy" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={3 + i * 7} y={11} width={5.5} height={10} rx={1.5} fill={i < 3 ? "#ccff00" : "#343a41"} />
    ))}
  </svg>,
  // heart line
  <svg key="heart" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <path d="M3 17h6l3-7 4 14 3-9 2 2h8" stroke="#ff3d6e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  // squad
  <svg key="squad" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <rect x="4" y="12" width="9" height="9" rx="2" fill="#b9a7f5" />
    <rect x="12" y="7" width="9" height="9" rx="2" fill="#f7a8c8" />
    <rect x="19" y="13" width="9" height="9" rx="2" fill="#7fe0c8" />
  </svg>,
  // offline
  <svg key="offline" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <path d="M5 22l7-10 5 6 4-5 6 9H5z" fill="#7fb6f5" />
    <circle cx="23" cy="8" r="3" fill="#ccff00" />
  </svg>,
];

export function How({ dict }: { dict: Dictionary["how"] }) {
  return (
    <Section id="how" kicker={dict.kicker} title={dict.title}>
      <ul className="mt-14 grid gap-4 sm:grid-cols-2">
        {dict.items.map((item, i) => (
          <li
            key={item.title}
            className="group rounded-3xl border border-line bg-surface/60 p-7 transition-colors duration-300 hover:border-muted/40 hover:bg-surface"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-night">{ICONS[i]}</div>
            <h3 className="mt-6 font-display text-xl font-semibold">{item.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
