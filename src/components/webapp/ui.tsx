"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The web app's building blocks, after the phone's components/ui.tsx: cards, kickers, pills, rows, bars, big buttons.
 * Same tones as the app (theme.ts `tone`): volt = the main action and progress, pulse = live and competition, lilac =
 * the coach, mint = the daily move and health, sky = information and settings, butter = needs attention.
 */

export type Tone = "volt" | "pulse" | "lilac" | "mint" | "sky" | "butter" | "down" | "faint" | "up";

const TEXT: Record<Tone, string> = {
  volt: "text-volt-fg",
  pulse: "text-pulse-fg",
  lilac: "text-lilac-fg",
  mint: "text-mint-fg",
  sky: "text-sky-fg",
  butter: "text-butter-fg",
  down: "text-down-fg",
  up: "text-up-fg",
  faint: "text-faint",
};
const FILL: Record<Tone, string> = {
  volt: "bg-volt",
  pulse: "bg-pulse",
  lilac: "bg-lilac",
  mint: "bg-mint",
  sky: "bg-sky",
  butter: "bg-butter",
  down: "bg-down",
  up: "bg-up",
  faint: "bg-faint",
};
export const toneText = (t: Tone) => TEXT[t];

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line bg-surface p-4",
        tone === "pulse" && "border-pulse-fg/40",
        tone === "butter" && "border-butter-fg/40",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Kicker({ children, tone = "faint", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <p className={cn("font-sans text-[11px] font-semibold tracking-[0.14em] uppercase", TEXT[tone], className)}>{children}</p>;
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-2xl leading-tight font-bold">{children}</h1>;
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("font-display text-[17px] leading-snug font-semibold", className)}>{children}</h2>;
}

export function Small({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-4 text-muted", className)}>{children}</p>;
}

export function Pill({ children, tone = "volt", label }: { children: ReactNode; tone?: Tone; label?: string }) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-sm font-semibold",
        TEXT[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Bar({ fraction, tone = "volt", label }: { fraction: number; tone?: Tone; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className={cn("h-full rounded-full", FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

type BtnVariant = "primary" | "volt" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-pulse text-ink hover:bg-pulse-soft",
  volt: "bg-volt text-ink hover:brightness-95",
  ghost: "border border-line bg-surface-2 text-text hover:border-muted/60",
  danger: "border border-down-fg/50 bg-surface-2 text-down-fg hover:bg-down/10",
};

export function Btn({
  variant = "primary",
  className,
  big,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; big?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 font-display text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50",
        big ? "h-14 text-base" : "h-12",
        BTN[variant],
        className,
      )}
    />
  );
}

export function LinkBtn({
  href,
  children,
  variant = "ghost",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 font-display text-sm font-semibold",
        BTN[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}

/** A tappable row in a list (the phone's ListRow): an icon dot, a title, a detail, a value, a chevron. */
export function Row({
  title,
  detail,
  value,
  tone = "sky",
  icon,
  onClick,
  href,
}: {
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-base", TEXT[tone])}>
        {icon ?? "●"}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-medium">{title}</span>
        {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
      </span>
      {value !== undefined && <span className="text-sm text-muted">{value}</span>}
      {(onClick || href) && (
        <span aria-hidden className="text-faint">
          ›
        </span>
      )}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-2/60";
  if (href)
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

export function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>;
}

export function Note({ children, tone = "sky" }: { children: ReactNode; tone?: Tone }) {
  return <p className={cn("rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm", TEXT[tone])}>{children}</p>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-xl border border-line bg-night px-4 text-base text-text placeholder:text-faint outline-none focus:border-pulse-fg";

/** A choice among a few (segmented control). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold",
            value === o.value ? "bg-volt text-ink" : "text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-volt" : "bg-surface-2 ring-1 ring-line")}
    >
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-night shadow transition-all", on ? "left-7" : "left-1")} />
    </button>
  );
}
