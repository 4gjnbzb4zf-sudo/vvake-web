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

/**
 * The Plus "+" on the logo (the apps draw the same): a volt disc with a dark plus, cut out of the logo by a ring of the
 * page's background so it stays crisp on the hand, in both themes. Shown only for an account with Plus.
 */
export function PlusBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-3.5 w-3.5", className)} aria-hidden="true">
      <circle cx="10" cy="10" r="9.25" fill="var(--color-volt)" stroke="var(--color-night)" strokeWidth="1.5" />
      <path d="M10 5.6v8.8M5.6 10h8.8" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The wordmark: the hand is the W of WAKE, so the sign and the name read as one word ([hand]AKE). `plus`: the signed-in
 * account has VVake Coach Plus (a small "+" at the top right); never set without it.
 */
export function Logo({
  className,
  plus = false,
  plusLabel = "VVake Coach Plus",
}: {
  className?: string;
  animated?: boolean;
  plus?: boolean;
  plusLabel?: string;
}) {
  return (
    <span className={cn("relative inline-flex items-end", className)} role="img" aria-label={plus ? plusLabel : "VVake"}>
      <LogoMark className="-mr-0.5 h-[1.9rem]" />
      <span aria-hidden="true" className="font-display text-[1.15rem] leading-[1.02] font-semibold tracking-[0.12em] text-text">
        AKE
      </span>
      {plus && <PlusBadge className="absolute -top-1.5 -right-3.5" />}
    </span>
  );
}
