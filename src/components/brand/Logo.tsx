import { cn } from "@/lib/cn";

/**
 * The VVake sign as a mark: a W whose three tips are the three raised fingers (the middle one tallest, the outer
 * ones slightly spread), running on into a heartbeat line, with a sunrise dot over the middle finger.
 */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 74 40" fill="none" className={cn("h-7 w-auto", className)} aria-hidden="true">
      <defs>
        <linearGradient id="vv-stroke" x1="0" y1="0" x2="74" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff3d6e" />
          <stop offset="0.55" stopColor="#ff7a9a" />
          <stop offset="1" stopColor="#ccff00" />
        </linearGradient>
      </defs>
      <path
        d="M4 13 L13 34 L22 9 L31 34 L40 13 L45.5 23 L49.5 23 L53.5 11 L58 35 L62 23 L71 23"
        stroke="url(#vv-stroke)"
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={animated ? 1 : undefined}
        strokeDashoffset={animated ? 1 : undefined}
        className={animated ? "animate-draw" : undefined}
      />
      <circle cx="22" cy="3" r="2.6" fill="#ff3d6e" />
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark animated={animated} />
      <span className="font-display text-[1.05rem] font-semibold tracking-[0.14em] text-text">VVAKE</span>
    </span>
  );
}
