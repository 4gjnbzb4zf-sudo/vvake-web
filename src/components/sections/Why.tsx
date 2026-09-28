import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { VVakerTraits } from "@/components/vvaker/traits";
import type { Dictionary } from "@/i18n/dictionaries";

/** One VVaker per audience, so each card reads at a glance. */
const AVATARS: readonly Partial<VVakerTraits>[] = [
  { color: "coral", sport: "runner", headgear: "none", eyes: "fired", mouth: "grin", accessory: "bib", bib: 42, energy: 4 },
  { color: "sky", sport: "walker", headgear: "cap", accent: "flame", accessory: "towel", energy: 3 },
  { color: "butter", sport: "baller", headgear: "beanie", eyes: "star", mouth: "grin", accessory: "medal", energy: 3 },
  { color: "mint", sport: "coder", headgear: "headphones", accent: "volt", eyes: "happy", mouth: "calm", energy: 2 },
];

export function Why({ dict, index }: { dict: Dictionary["why"]; index: string }) {
  return (
    <Section id="why" index={index} kicker={dict.kicker} title={dict.title}>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dict.items.map((item, i) => (
          <li
            key={item.who}
            className="group relative overflow-hidden rounded-3xl border border-line bg-surface/60 p-6 transition-colors duration-300 hover:border-pulse/40"
          >
            <div className="bg-voxel-grid -mx-6 -mt-6 mb-5 flex h-40 items-end justify-center border-b border-line bg-night-2">
              <VVaker {...AVATARS[i]!} className="h-36 w-auto transition-transform duration-300 group-hover:-translate-y-1" />
            </div>
            <p className="font-mono text-[0.7rem] tracking-[0.16em] text-pulse uppercase">{item.who}</p>
            <h3 className="mt-3 font-display text-lg leading-snug font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-8 flex flex-wrap gap-2">
        {dict.proof.map((p) => (
          <li key={p} className="rounded-full border border-line bg-surface/60 px-3.5 py-1.5 font-mono text-xs text-muted">
            <span className="mr-1.5 text-volt">✓</span>
            {p}
          </li>
        ))}
      </ul>
    </Section>
  );
}
