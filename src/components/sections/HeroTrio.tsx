import { Shot } from "@/components/ui/Shot";

/**
 * The app's welcome crew (same three as the phone's first screen): the first thing a phone visitor sees.
 * Pre-sized (420 px tall, 2× the largest size shown) instead of the 900 px cast files.
 */
const TRIO = [
  { id: "walker-f", w: 176, className: "h-[170px] w-auto -mr-7" },
  { id: "runner-m", w: 224, className: "relative z-10 h-[210px] w-auto" },
  { id: "baller-f", w: 203, className: "h-[170px] w-auto -ml-7" },
] as const;

export function HeroTrio() {
  return (
    <div className="mb-5 flex items-end justify-center drop-shadow-[0_24px_30px_rgb(0_0_0/0.55)] lg:hidden" aria-hidden="true">
      {TRIO.map(({ id, w, className }) => (
        <Shot key={id} name={`cast-${id}`} width={w} height={420} alt="" eager className={className} />
      ))}
    </div>
  );
}
