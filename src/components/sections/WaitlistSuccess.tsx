"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { personaSrc } from "@/lib/personas";
import { usePersona } from "@/lib/prefs";
import { randomVariant, referralUrl, shareUrl, type ShareNetwork } from "@/lib/referral";
import { renderStoryCard } from "@/lib/storyCard";
import type { SignupResponse } from "@/lib/waitlist";

const NETWORKS: readonly ShareNetwork[] = ["x", "whatsapp", "telegram", "linkedin", "threads"];

/** After a confirmed signup: rank, tier, invite link, sharing, story card and the invite ladder. */
export function WaitlistSuccess(props: {
  data: SignupResponse;
  city: string;
  citySlug: string;
  dict: Dictionary["unlock"]["success"];
  locale: Locale;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const persona = usePersona();
  const d = props.dict;
  const link = referralUrl(props.siteUrl, props.locale, props.data.referralCode, props.citySlug);
  // Each post gets a random share page, so its preview shows a different duo and challenge.
  const postLink = () => referralUrl(props.siteUrl, props.locale, props.data.referralCode, props.citySlug, randomVariant());
  const shareText = format(d.shareText, { city: props.city, rank: props.data.cityRank });

  useEffect(() => {
    // Native share sheet (phones): shows up after mount so the server render stays the same.
    const id = window.setTimeout(() => setCanShare(typeof navigator.share === "function"), 0);
    return () => window.clearTimeout(id);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const storyCard = () =>
    renderStoryCard({
      lines: [d.campaign[0]!, d.campaign[1]!],
      rank: format(d.storyRank, { rank: props.data.cityRank, city: props.city }),
      tier: props.data.tier ? d.tier[props.data.tier] : undefined,
      footer: format(d.storyFooter, { code: props.data.referralCode }),
      personaSrc: personaSrc(persona.sport),
    });

  async function downloadStory() {
    setBusy(true);
    try {
      const blob = await storyCard();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vvake-${props.citySlug || "city"}-story.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  /** Phones: the share sheet, with the story card attached when the platform accepts files (Instagram, TikTok…). */
  async function nativeShare() {
    try {
      const file = new File([await storyCard()], "vvake-story.png", { type: "image/png" });
      const url = postLink();
      const withFile = { text: shareText, url, files: [file] };
      await navigator.share(navigator.canShare?.(withFile) ? withFile : { text: shareText, url });
    } catch {
      // Dismissed or unsupported: nothing to do.
    }
  }

  return (
    <div role="status">
      <h3 className="font-display text-2xl font-semibold">{d.title}</h3>
      <p className="mt-3 text-muted">{format(d.rank, { rank: props.data.cityRank, city: props.city })}</p>
      {props.data.tier && (
        <p className="mt-4 inline-flex rounded-full border border-volt-fg/40 bg-volt/10 px-3 py-1 font-mono text-xs tracking-[0.15em] text-volt-fg uppercase">
          {d.tier[props.data.tier]}
        </p>
      )}
      {props.data.pendingVerification && <p className="mt-4 text-sm text-muted">{d.pending}</p>}

      <p className="mt-6 font-display text-lg leading-tight font-bold">
        {d.campaign[0]} <span className="text-pulse-fg">{d.campaign[1]}</span>
      </p>
      <p className="mt-1 text-sm text-muted">{format(d.shareLabel, { city: props.city })}</p>

      <div className="mt-4 flex gap-2">
        <input
          readOnly
          value={link}
          aria-label={d.referralLabel}
          className={cn(inputClass, "font-mono text-xs")}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy} className={buttonClass("ghost", "shrink-0")}>
          {copied ? d.copied : d.copy}
        </button>
      </div>

      {canShare && (
        <button type="button" onClick={nativeShare} className={buttonClass("primary", "mt-3 w-full")}>
          ↗ {d.nativeShare}
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {NETWORKS.map((n) => (
          <a
            key={n}
            href={shareUrl(n, shareText, link)}
            onClick={(e) => {
              e.preventDefault();
              window.open(shareUrl(n, shareText, postLink()), "_blank", "noopener,noreferrer");
            }}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
              n === "x" && !canShare
                ? "border-pulse bg-pulse text-ink hover:bg-pulse-soft"
                : "border-line text-text hover:border-volt-fg/60",
            )}
          >
            {d.networks[n]}
          </a>
        ))}
      </div>

      <button type="button" onClick={downloadStory} disabled={busy} className={buttonClass("ghost", "mt-3 w-full")}>
        ⬇ {d.story}
      </button>
      <p className="mt-1.5 text-xs text-faint">{d.storyHint}</p>

      <div className="mt-6 rounded-2xl border border-line bg-night/40 p-4">
        <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">{d.ladder.title}</p>
        <ol className="mt-3 space-y-2">
          {d.ladder.steps.map((step) => (
            <li key={step.n} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-volt-fg">
                {step.n}
              </span>
              <span aria-hidden="true">{step.icon}</span>
              <span className="text-sm">
                <span className="font-semibold">{step.title}</span> <span className="text-muted">· {step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-faint">{d.ladder.note}</p>
      </div>
    </div>
  );
}
