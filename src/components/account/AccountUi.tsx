"use client";

import { useCallback, useState, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** A settings card: a small mono title, an optional lead and badge, then rows. */
export function Card({
  title,
  lead,
  badge,
  children,
  className,
}: {
  title: string;
  lead?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-line bg-surface/60 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{title}</h3>
        {badge}
      </div>
      {lead && <p className="mt-2 text-sm leading-relaxed text-muted">{lead}</p>}
      {children}
    </div>
  );
}

/** One setting: label (and hint) on the left, the control on the right; stacked on phones. */
export function Row({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line/60 py-4 first-of-type:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm text-text">
            {label}
          </label>
        ) : (
          <p className="text-sm text-text">{label}</p>
        )}
        {hint && <p className="mt-1 text-xs leading-relaxed text-faint">{hint}</p>}
      </div>
      {children !== undefined && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{children}</div>}
    </div>
  );
}

/** An on/off switch (role="switch"). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-pulse-fg bg-pulse" : "border-line bg-night",
      )}
    >
      <span
        className={cn("inline-block h-5 w-5 rounded-full bg-text transition-transform", checked ? "translate-x-6 bg-ink" : "translate-x-1")}
      />
    </button>
  );
}

/** A select in the site's input style. */
export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  id?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(inputBase, "h-10 w-auto min-w-40 pr-8 text-sm", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** The site's input look without its full width (cn doesn't merge classes): each use sets its own width. */
const inputBase = inputClass.replace(/\bw-full\b/, "").replace(/\bh-12\b/, "");
export const smallInput = cn(inputBase, "h-10 text-sm");
export const smallButton = (variant: "primary" | "ghost" = "ghost", className?: string) =>
  buttonClass(variant, cn("h-10 px-4 text-xs", className));
export const linkButton = "text-sm text-muted underline underline-offset-4 hover:text-text disabled:opacity-50";

/** A value shown, not edited (read-only rows). */
export function Value({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted tabular-nums">{children}</span>;
}

/** A small pill: "In the app", "Connected", a status. */
export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "warn" | "volt" }) {
  const tones = {
    muted: "border-line text-muted",
    ok: "border-up-fg/40 text-up-fg",
    warn: "border-butter-fg/40 text-butter-fg",
    volt: "border-volt-fg/40 text-volt-fg",
  };
  return <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap", tones[tone])}>{children}</span>;
}

/** A status line under a card: saved, an error. */
export function Status({ msg, error }: { msg: string | null; error?: boolean }) {
  if (!msg) return null;
  return (
    <p className={cn("mt-3 text-sm", error ? "text-down-fg" : "text-up-fg")} role={error ? "alert" : "status"}>
      {msg}
    </p>
  );
}

/**
 * One async action at a time per card, with its message: `run(fn, okMsg)` sets busy, shows `okMsg` (or nothing) on
 * success and `errorMsg(e)` on failure.
 */
export function useAction(errorMsg: (e: unknown) => string) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const run = useCallback(
    async (fn: () => Promise<unknown>, ok?: string) => {
      setBusy(true);
      setMsg(null);
      try {
        await fn();
        if (ok) setMsg({ text: ok, error: false });
        return true;
      } catch (e) {
        setMsg({ text: errorMsg(e), error: true });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [errorMsg],
  );
  return { busy, run, status: <Status msg={msg?.text ?? null} error={msg?.error} />, clear: () => setMsg(null) };
}
