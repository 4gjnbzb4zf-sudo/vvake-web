import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

interface SectionProps {
  id?: string;
  /** Editorial number shown before the kicker, e.g. "03". */
  index?: string;
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "left" | "center";
  /** Label in the section navigator for a section without a numbered kicker (e.g. the FAQ). */
  nav?: string;
}

export function Section({ id, index, kicker, title, lead, children, className, align = "left", nav }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      // Picked up by the section navigator (SectionNav): numbered sections with a kicker, or an explicit label.
      data-nav={id ? (nav ?? (index && typeof kicker === "string" ? kicker : undefined)) : undefined}
      data-nav-index={id && index ? index : undefined}
      className={cn("relative border-t border-line/60 py-20 sm:py-28", className)}
    >
      <Container>
        <header className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
          {kicker && <Kicker index={index}>{kicker}</Kicker>}
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

/** Editorial kicker: "03 / MARKET PULSE". */
export function Kicker({ children, index }: { children: ReactNode; index?: string }) {
  return (
    <p className="font-mono text-xs tracking-[0.2em] text-faint uppercase">
      {index && (
        <>
          <span className="text-pulse-fg">{index}</span>
          <span aria-hidden="true"> / </span>
        </>
      )}
      {children}
    </p>
  );
}
