import type { ReactNode } from "react";
import { SignText } from "@/components/brand/SignText";
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
  /** "split": on wide screens the title sits left and the lead right, bottom-aligned (the home page's sections). */
  layout?: "stack" | "split";
  /** Label in the section navigator for a section without a numbered kicker (e.g. the FAQ). */
  nav?: string;
}

export function Section({ id, index, kicker, title, lead, children, className, align = "left", layout = "stack", nav }: SectionProps) {
  const split = layout === "split" && Boolean(lead);
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
        <header
          className={cn(
            "max-w-3xl",
            align === "center" && "mx-auto text-center",
            split && "lg:grid lg:max-w-none lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-16",
          )}
        >
          <div>
            {kicker && <Kicker index={index}>{kicker}</Kicker>}
            <h2 id={headingId} className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-tight text-text sm:text-5xl">
              {typeof title === "string" ? <SignText text={title} /> : title}
            </h2>
          </div>
          {lead && <p className={cn("mt-5 text-lg leading-relaxed text-muted", split && "lg:mt-0")}>{lead}</p>}
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
