import { cn } from "@/lib/cn";
import { HAND_DOT, HAND_PATH, HAND_TRANSFORM, HAND_VIEWBOX } from "./handMark";

/** The VVake sign: the hand (in the text color, so it follows the theme) and the lime sunrise dot. */
export function LogoMark({ className }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox={HAND_VIEWBOX} className={cn("h-8 w-auto text-text", className)} aria-hidden="true">
      <g transform={HAND_TRANSFORM} fill="currentColor">
        <path d={HAND_PATH} />
      </g>
      <circle {...HAND_DOT} fill="var(--color-volt-fg)" />
    </svg>
  );
}

/** Just the two Vs (the W part of the mark), to write "VVaker" with the logo in small UI. */
export function VVMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 40" fill="none" className={cn("h-4 w-auto", className)} aria-hidden="true">
      <defs>
        <linearGradient id="vv-mark" x1="0" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff3d6e" />
          <stop offset="1" stopColor="#ff9fb6" />
        </linearGradient>
      </defs>
      <path d="M4 13 L13 34 L22 9 L31 34 L40 13" stroke="url(#vv-mark)" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="3" r="2.6" fill="#ff3d6e" />
    </svg>
  );
}

export function Logo({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark animated={animated} />
      <span className="font-display text-[1.05rem] font-semibold tracking-[0.14em] text-text">VVAKE</span>
    </span>
  );
}
