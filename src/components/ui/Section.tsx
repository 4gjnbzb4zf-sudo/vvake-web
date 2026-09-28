import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

interface SectionProps {
  id?: string;
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "left" | "center";
}

export function Section({ id, kicker, title, lead, children, className, align = "left" }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("relative py-20 sm:py-28", className)}>
      <Container>
        <header className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
          {kicker && <Kicker>{kicker}</Kicker>}
          <h2 id={headingId} className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-tight text-text sm:text-5xl">
            {title}
          </h2>
          {lead && <p className="mt-5 text-lg leading-relaxed text-muted">{lead}</p>}
        </header>
        {children}
      </Container>
    </section>
  );
}

export function Kicker({ children, tone = "pulse" }: { children: ReactNode; tone?: "pulse" | "volt" | "calm" }) {
  const tones = {
    pulse: "text-pulse border-pulse/30 bg-pulse/10",
    volt: "text-volt border-volt/30 bg-volt/10",
    calm: "text-calm border-calm/30 bg-calm/10",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-medium tracking-[0.18em] uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
