import { Section } from "@/components/ui/Section";
import { SportName } from "@/lib/sportNames";
import type { VVakerTraits } from "@/components/vvaker/traits";
import { VVaker } from "@/components/vvaker/VVaker";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { sessionEffort, type Zone } from "@/lib/effort";
import { sportGroups, sports } from "@/lib/sports";
import type { Locale } from "@/i18n/config";

interface Tile {
  sport: keyof Dictionary["multisport"]["sports"];
  minutes: number;
  zone: Zone;
  /** Meditation lowers heart rate, so it earns calm points (2/min, max 40) instead of zone effort. */
  mindful?: boolean;
  look: Partial<VVakerTraits>;
  tint: string;
}

const TILES: readonly Tile[] = [
  {
    sport: "runner",
    minutes: 25,
    zone: 3,
    look: { color: "candy", accessory: "bib", bib: 10, eyes: "fired", mouth: "grin" },
    tint: "from-pulse/25",
  },
  {
    sport: "cyclist",
    minutes: 45,
    zone: 2,
    look: { color: "slate", headgear: "helmet", accent: "flame", eyes: "visor" },
    tint: "from-[#ff8a3d]/25",
  },
  {
    sport: "lifter",
    minutes: 30,
    zone: 3,
    look: { color: "butter", headgear: "cap", accent: "ocean", mouth: "teeth" },
    tint: "from-butter/25",
  },
  { sport: "boxer", minutes: 20, zone: 4, look: { color: "coral", accent: "snow", eyes: "fired", mouth: "teeth" }, tint: "from-down/25" },
  { sport: "yogi", minutes: 40, zone: 1, look: { color: "lilac", accent: "calm", eyes: "happy", mouth: "calm" }, tint: "from-lilac/25" },
  { sport: "baller", minutes: 35, zone: 3, look: { color: "mint", headgear: "beanie", eyes: "star", mouth: "grin" }, tint: "from-mint/25" },
  {
    sport: "walker",
    minutes: 50,
    zone: 2,
    look: { color: "sky", headgear: "cap", accent: "flame", accessory: "towel" },
    tint: "from-sky/25",
  },
  {
    sport: "coder",
    minutes: 10,
    zone: 2,
    look: { color: "olive", headgear: "headphones", accent: "volt", eyes: "happy" },
    tint: "from-volt/20",
  },
  {
    sport: "martial",
    minutes: 30,
    zone: 4,
    look: { color: "slate", eyes: "fired", mouth: "teeth", accent: "snow" },
    tint: "from-[#eef0f2]/15",
  },
  { sport: "paddler", minutes: 60, zone: 2, look: { color: "sky", headgear: "cap", accent: "flame", eyes: "happy" }, tint: "from-sky/25" },
  {
    sport: "meditator",
    minutes: 10,
    zone: 1,
    mindful: true,
    look: { color: "lilac", eyes: "happy", mouth: "calm", accent: "calm" },
    tint: "from-calm/25",
  },
  {
    sport: "roller",
    minutes: 40,
    zone: 3,
    look: { color: "candy", headgear: "helmet", accent: "volt", eyes: "star", mouth: "grin" },
    tint: "from-pulse/25",
  },
  {
    sport: "swimmer",
    minutes: 30,
    zone: 3,
    look: { color: "mint", headgear: "none", accent: "ocean", eyes: "pixel", mouth: "grin" },
    tint: "from-sky/25",
  },
  {
    sport: "skater",
    minutes: 45,
    zone: 2,
    look: { color: "sky", headgear: "beanie", accent: "snow", eyes: "happy", mouth: "smile" },
    tint: "from-sky/25",
  },
  {
    sport: "hiker",
    minutes: 120,
    zone: 2,
    look: { color: "olive", headgear: "cap", accent: "flame", eyes: "happy", mouth: "grin" },
    tint: "from-[#8a9a5b]/25",
  },
  {
    sport: "climber",
    minutes: 60,
    zone: 3,
    look: { color: "coral", accent: "volt", eyes: "fired", mouth: "teeth" },
    tint: "from-[#ff8a3d]/20",
  },
  { sport: "racket", minutes: 60, zone: 3, look: { color: "butter", accent: "volt", eyes: "fired", mouth: "grin" }, tint: "from-volt/20" },
  {
    sport: "dancer",
    minutes: 45,
    zone: 3,
    look: { color: "lilac", accent: "pulse", eyes: "star", mouth: "grin", headgear: "headphones" },
    tint: "from-pulse/25",
  },
  { sport: "skier", minutes: 90, zone: 3, look: { color: "sky", headgear: "helmet", accent: "flame", eyes: "visor" }, tint: "from-sky/25" },
  {
    sport: "footballer",
    minutes: 60,
    zone: 4,
    look: { color: "mint", accent: "pulse", eyes: "pixel", mouth: "grin", fan: "lyon-football" },
    tint: "from-mint/25",
  },
];

export function Multisport({ dict, index, locale }: { dict: Dictionary["multisport"]; index: string; locale: Locale }) {
  return (
    <Section id="multisport" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <p className="mt-6 inline-flex rounded-xl border border-volt-fg/30 bg-volt/10 px-4 py-2 font-mono text-xs text-volt-fg">
        {dict.formula}
      </p>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TILES.map((tile) => (
          <li
            key={tile.sport}
            className="group relative overflow-hidden rounded-3xl border border-line bg-surface/60 transition-all duration-300 hover:-translate-y-1 hover:border-pulse-fg/40"
          >
            <div className={`bg-gradient-to-b ${tile.tint} to-transparent px-3 pt-4`}>
              <VVaker
                sport={tile.sport}
                energy={4}
                {...tile.look}
                className="mx-auto h-36 w-auto transition-transform duration-300 group-hover:scale-105 sm:h-44"
              />
            </div>
            <div className="border-t border-line p-4">
              <p className="font-display text-lg font-semibold">
                <SportName sport={tile.sport} name={dict.sports[tile.sport]} />
              </p>
              <p className="mt-1 font-mono text-[0.7rem] text-faint">
                {dict.example} · {tile.mindful ? `${tile.minutes} min` : format(dict.session, { minutes: tile.minutes, zone: tile.zone })}
              </p>
              {tile.mindful ? (
                <p className="mt-3 font-display text-2xl font-bold text-calm-fg">
                  +{Math.min(40, tile.minutes * 2)} <span className="text-sm font-semibold text-muted">{dict.mindful}</span>
                </p>
              ) : (
                <p className="mt-3 font-display text-2xl font-bold text-pulse-fg">
                  {sessionEffort(tile.minutes, tile.zone)} <span className="text-sm font-semibold text-muted">{dict.effortUnit}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-faint">{dict.note}</p>
      <div className="mt-12 rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
        <h3 className="font-display text-xl font-semibold">{format(dict.catalogTitle, { count: sports.count })}</h3>
        <p className="mt-2 text-sm text-muted">{dict.catalogBody}</p>
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {sportGroups(locale).map((g) => (
            <div key={g.key}>
              <dt className="font-mono text-[0.7rem] tracking-wider text-faint uppercase">{g.title}</dt>
              <dd className="mt-1 text-sm text-muted">{g.names.join(" · ")}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-8 font-display text-xl font-semibold">{dict.customTitle}</h3>
        <p className="mt-2 text-sm text-muted">{dict.customBody}</p>
      </div>
    </Section>
  );
}
