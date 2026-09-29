import { cn } from "@/lib/cn";

/**
 * The VVake sign as a mark: the hand throwing it (index, middle and ring fingers raised and spread from the palm,
 * so the gaps between them draw the W), with the sunrise dot over the middle finger.
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  const draw = animated ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1, className: "animate-draw" } : {};
  return (
    <svg viewBox="0 0 40 46" fill="none" className={cn("h-8 w-auto", className)} aria-hidden="true">
      <defs>
        <linearGradient id="vv-hand" x1="0" y1="46" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff3d6e" />
          <stop offset="0.6" stopColor="#ff7a9a" />
          <stop offset="1" stopColor="#ccff00" />
        </linearGradient>
      </defs>
      <g stroke="url(#vv-hand)" strokeWidth="6" strokeLinecap="round">
        <path d="M14 34 L5.5 13" {...draw} />
        <path d="M20 33 L20 9" {...draw} />
        <path d="M26 34 L34.5 13" {...draw} />
      </g>
      <path d="M11.5 30 Q11 43 20 43 Q29 43 28.5 30 Z" fill="url(#vv-hand)" />
      <circle cx="20" cy="3" r="2.8" fill="#ff3d6e" />
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
