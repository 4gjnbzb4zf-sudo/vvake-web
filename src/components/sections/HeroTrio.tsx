import Image from "next/image";
import { castImage, type CastId } from "@/lib/personas";

/** The app's welcome crew (same three as the phone's first screen): the first thing a phone visitor sees. */
const TRIO: { id: CastId; className: string }[] = [
  { id: "walker-f", className: "h-[170px] -mr-7" },
  { id: "runner-m", className: "relative z-10 h-[210px]" },
  { id: "baller-f", className: "h-[170px] -ml-7" },
];

export function HeroTrio() {
  return (
    <div className="mb-5 flex animate-rise items-end justify-center drop-shadow-[0_24px_30px_rgb(0_0_0/0.55)] lg:hidden" aria-hidden="true">
      {TRIO.map(({ id, className }) => {
        const img = castImage(id);
        return <Image key={id} src={img.src} width={img.w} height={img.h} alt="" priority className={`w-auto ${className}`} />;
      })}
    </div>
  );
}
