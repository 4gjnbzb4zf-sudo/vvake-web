"use client";

import type { WebAppDict } from "@/i18n/webapp";
import { cn } from "@/lib/cn";

/**
 * "Get the app": App Store and Google Play badges drawn in the site's style, both marked "Coming soon" and on purpose
 * not links. No live store link goes on the site until the internal tests pass; when the apps are public, turn the
 * badges into links here, once, for every screen that shows them (sign-in, You, the "only in the app" notes).
 */
export function GetTheApp({ t, compact, className }: { t: WebAppDict; compact?: boolean; className?: string }) {
  const s = t.common.stores;
  return (
    <section aria-label={t.common.getApp} className={cn(!compact && "rounded-2xl border border-line bg-surface p-4", className)}>
      {!compact && <h2 className="font-display text-[17px] leading-snug font-semibold">{t.common.getApp}</h2>}
      <div className={cn("grid grid-cols-2 gap-2", !compact && "mt-3")}>
        <Badge soon={s.soon} store={s.appStore} label={`${s.appStore}: ${s.soon}`} icon={<PhoneIcon />} />
        <Badge soon={s.soon} store={s.googlePlay} label={`${s.googlePlay}: ${s.soon}`} icon={<PlayIcon />} />
      </div>
      <p className="mt-2 text-xs leading-4 text-muted">{s.line}</p>
    </section>
  );
}

function Badge({ soon, store, label, icon }: { soon: string; store: string; label: string; icon: React.ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-text opacity-90 select-none"
    >
      <span aria-hidden className="shrink-0 text-muted">
        {icon}
      </span>
      <span aria-hidden className="min-w-0 leading-tight">
        <span className="block text-[10px] font-semibold tracking-[0.12em] text-volt-fg uppercase">{soon}</span>
        <span className="block truncate text-sm font-semibold">{store}</span>
      </span>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}
