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

/** The hand as the W in text ("VVaker" in the menu reads [hand]AKER). */
export function VVMark({ className }: { className?: string }) {
  return <LogoMark className={cn("h-[1.35em] text-current", className)} />;
}

/** The wordmark: the hand is the W of WAKE, so the sign and the name read as one word ([hand]AKE). */
export function Logo({ className }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("inline-flex items-end", className)} aria-label="VVake">
      <LogoMark className="-mr-0.5 h-[1.9rem]" />
      <span aria-hidden="true" className="font-display text-[1.15rem] leading-[1.02] font-semibold tracking-[0.12em] text-text">
        AKE
      </span>
    </span>
  );
}
