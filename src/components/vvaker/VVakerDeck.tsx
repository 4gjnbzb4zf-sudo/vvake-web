import { VVaker } from "./VVaker";
import type { VVakerTraits } from "./traits";

interface DeckCard {
  look: Partial<VVakerTraits>;
  bg: string;
  rotate: string;
  offset: string;
}

/** Fanned deck of VVaker cards: "which one are you?" One per sport family, each with its own gear. */
const DECK: readonly DeckCard[] = [
  {
    look: { color: "olive", sport: "yogi", headgear: "beanie", accent: "calm", eyes: "happy", mouth: "calm", energy: 2 },
    bg: "bg-[#e6ecd9]",
    rotate: "-rotate-12",
    offset: "translate-y-6",
  },
  {
    look: { color: "slate", sport: "cyclist", headgear: "helmet", accent: "flame", eyes: "visor", energy: 3 },
    bg: "bg-[#f1ddd6]",
    rotate: "-rotate-6",
    offset: "translate-y-2",
  },
  {
    look: { color: "candy", sport: "runner", eyes: "star", mouth: "grin", accessory: "medal", energy: 4 },
    bg: "bg-[#dbe4ef]",
    rotate: "rotate-0",
    offset: "-translate-y-2",
  },
  {
    look: { color: "coral", sport: "boxer", accent: "snow", eyes: "fired", mouth: "teeth", energy: 3 },
    bg: "bg-[#d9dde6]",
    rotate: "rotate-6",
    offset: "translate-y-2",
  },
  {
    look: { color: "butter", sport: "lifter", headgear: "cap", accent: "ocean", accessory: "bib", bib: 99, energy: 3 },
    bg: "bg-[#f1ead9]",
    rotate: "rotate-12",
    offset: "translate-y-6",
  },
];

export function VVakerDeck() {
  return (
    <div className="mt-12 flex justify-center" aria-hidden="true">
      {DECK.map((card, i) => (
        <div
          key={card.bg}
          className={`relative ${i === 2 ? "z-10" : "z-0"} -mx-5 w-28 shrink-0 sm:-mx-6 sm:w-40 ${card.rotate} ${card.offset} transition-transform duration-300 hover:z-20 hover:-translate-y-4`}
        >
          <div
            className={`aspect-[3/4] overflow-hidden rounded-2xl border-2 ${i === 2 ? "border-volt" : "border-night"} ${card.bg} shadow-2xl shadow-black/60`}
          >
            <VVaker {...card.look} className="h-full w-full p-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
