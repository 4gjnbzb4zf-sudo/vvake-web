"use client";

import { useEffect, useState } from "react";
import { getSeasonDict } from "@/i18n/season";
import { fmt } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import type { PlanChange } from "@/lib/webapp/api";
import { countdown, shareText, verdictTone, type FeasibilityText, type GoalStatus, type SeasonCard } from "@/lib/webapp/season";
import { seasonCardImage } from "@/lib/webapp/seasonShare";
import { useApp } from "./AppContext";
import { Btn, Card, Kicker, Small, toneText } from "./ui";

/** Readiness 0–100 as a ring (the app's readiness ring), its number inside. */
export function ReadinessRing({ value, size = 48, label }: { value: number; size?: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <span role="img" aria-label={`${label} ${v}/100`} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          className={v >= 70 ? "stroke-mint-fg" : v >= 35 ? "stroke-volt-fg" : "stroke-butter-fg"}
        />
      </svg>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center text-xs font-bold">
        {v}
      </span>
    </span>
  );
}

export function VerdictChip({ verdict, label }: { verdict: string; label?: string }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const tone = verdictTone(verdict);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 text-xs font-semibold",
        toneText(tone),
      )}
    >
      <span aria-hidden>{verdict === "realistic" ? "✓" : verdict === "too-risky" ? "!" : "↗"}</span>
      {label ?? s.verdict[verdict] ?? verdict}
    </span>
  );
}

export function Chip({ children, tone = "faint" }: { children: React.ReactNode; tone?: Parameters<typeof toneText>[0] }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full border border-line bg-surface-2 px-2 text-xs font-semibold", toneText(tone))}
    >
      {children}
    </span>
  );
}

/** A goal on the season: name, priority, countdown, phase, readiness ring, verdict, on track. */
export function GoalLine({ g, priority, onClick }: { g: GoalStatus; priority?: string; onClick?: () => void }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const inner = (
    <>
      <ReadinessRing value={g.readiness ?? 0} label={s.readiness} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2">
          {priority && (
            <span className="rounded-md bg-surface-2 px-1.5 text-xs font-bold text-muted" aria-label={`${s.goal.priority} ${priority}`}>
              {priority}
            </span>
          )}
          <span className="text-[15px] font-semibold">{g.name}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip tone="volt">{fmt(s.goalDays, { days: countdown(g.days, lang) })}</Chip>
          {g.phaseLabel && <Chip tone="sky">{g.phaseLabel}</Chip>}
          {g.verdict && <VerdictChip verdict={g.verdict} />}
          {g.onTrack === false && <Chip tone="butter">{s.behind}</Chip>}
        </span>
      </span>
      {onClick && (
        <span aria-hidden className="text-faint">
          ›
        </span>
      )}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:bg-surface-2/60")}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** The feasibility review: verdict, headline, how it adds up, why, other ways (buttons), safety, not medical advice. */
export function ReviewCard({
  verdict,
  text,
  readiness,
  notMedical,
  onApply,
  busy,
  footer,
}: {
  verdict: string;
  text: FeasibilityText;
  readiness?: number;
  notMedical?: string | null;
  onApply?: (index: number) => void;
  busy?: boolean;
  footer?: React.ReactNode;
}) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Kicker tone="lilac">{s.review.kicker}</Kicker>
          <div className="mt-2">
            <VerdictChip verdict={verdict} />
          </div>
        </div>
        {readiness !== undefined && <ReadinessRing value={readiness} size={52} label={s.readiness} />}
      </div>
      <p className="mt-3 font-display text-[17px] leading-snug font-semibold">{text.headline}</p>
      {text.reasoning.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted">{s.review.reasoning}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {text.reasoning.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden className="text-faint">
                  ·
                </span>
                {r}
              </li>
            ))}
          </ul>
        </>
      )}
      {text.reasons.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted">{s.review.reasons}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {text.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden className="text-butter-fg">
                  ●
                </span>
                {r}
              </li>
            ))}
          </ul>
        </>
      )}
      {text.alternatives.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted">{s.review.alternatives}</p>
          <div className="mt-2 space-y-2">
            {text.alternatives.map((a, i) => (
              <div key={a} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm">{a}</span>
                {onApply && (
                  <Btn variant="ghost" className="h-10 shrink-0 px-3" disabled={busy} onClick={() => onApply(i)}>
                    {s.review.apply}
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {text.safety.length > 0 && (
        <div className="mt-3 rounded-xl border border-butter-fg/40 px-3 py-2">
          <p className="text-xs font-semibold text-butter-fg">{s.review.safety}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {text.safety.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {footer}
      <Small className="mt-3">{notMedical || s.notMedical}</Small>
    </Card>
  );
}

/** A coach proposal (the existing plan changes): the summary, a season change's lines, Approve / Keep my plan. */
export function ProposalCard({ c, onDecide, busy }: { c: PlanChange; onDecide: (d: "accept" | "reject") => void; busy?: boolean }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const lines = (c.season?.lines ?? []).filter((l) => l && l !== c.summary);
  return (
    <Card tone="butter">
      <Kicker tone="lilac">{s.proposal.kicker}</Kicker>
      <p className="mt-2 text-[15px]">{c.summary}</p>
      {lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden>→</span>
              {l}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn variant="volt" disabled={busy} onClick={() => onDecide("accept")}>
          {s.proposal.approve}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => onDecide("reject")}>
          {s.proposal.keep}
        </Btn>
      </div>
    </Card>
  );
}

/** Share the season card: an image (the share sheet, or saved), or the text with a link to VVake. */
export function ShareSeason({ card, onClose }: { card: SeasonCard; onClose: () => void }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = `https://vvake.com/${lang}/`;
  const text = shareText(card, { daysToGo: s.card.daysToGo, readiness: s.card.readiness }, link);

  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    void seasonCardImage(card, {
      kicker: s.card.kicker,
      daysUnit: s.card.daysUnit,
      readiness: s.card.readiness,
      footer: s.card.footer,
    }).then((b) => {
      if (gone || !b) return;
      made = URL.createObjectURL(b);
      setBlob(b);
      setUrl(made);
    });
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [card, s.card.kicker, s.card.daysUnit, s.card.readiness, s.card.footer]);

  const file = blob ? new File([blob], "vvake-season.png", { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.card.title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center"
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{s.card.title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-muted underline">
            {s.card.close}
          </button>
        </div>
        <Small className="mt-1">{s.card.lead}</Small>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-night">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={s.card.alt} className="block h-auto w-full" />
          ) : (
            <div className="aspect-[4/5] w-full animate-pulse bg-surface-2" />
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {canShareFile && (
            <Btn
              onClick={() => {
                void navigator.share({ files: [file!], text }).catch(() => undefined);
              }}
            >
              {s.card.shareImage}
            </Btn>
          )}
          {url && (
            <a
              href={url}
              download="vvake-season.png"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface-2 px-5 font-display text-sm font-semibold"
            >
              {s.card.download}
            </a>
          )}
          <Btn
            variant="ghost"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(text)
                .then(() => setCopied(true))
                .catch(() => undefined);
            }}
          >
            {copied ? s.card.copied : s.card.copy}
          </Btn>
        </div>
      </div>
    </div>
  );
}
