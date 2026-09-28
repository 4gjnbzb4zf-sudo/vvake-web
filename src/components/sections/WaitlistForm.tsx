"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CitySearch, type CitySelection } from "./CitySearch";
import { buttonClass } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Country } from "@/lib/cities";
import { cn } from "@/lib/cn";
import { readReferral, referralUrl, xShareUrl } from "@/lib/referral";
import { unlockProgress } from "@/lib/unlock";
import { fetchCityCounts, submitSignup, type CityCounts, type SignupResponse, type SignupResult } from "@/lib/waitlist";

export interface CityOption {
  slug: string;
  name: string;
  country: Country;
  metroPopulation: number;
  threshold: number;
  rivalSlug: string | null;
}

interface WaitlistFormProps {
  locale: Locale;
  dict: Dictionary["unlock"];
  countryLabels: Record<Country, string>;
  cities: readonly CityOption[];
  endpoint: string;
  siteUrl: string;
  privacyHref: string;
  social: { x: string; xHandle: string };
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; data: SignupResponse }
  | { kind: "error"; code: Extract<SignupResult, { ok: false }>["error"] };

export function WaitlistForm({ locale, dict, countryLabels, cities, endpoint, siteUrl, privacyHref, social }: WaitlistFormProps) {
  const searchParams = useSearchParams();
  const [chosen, setChosen] = useState<CitySelection | null>(null);
  const [counts, setCounts] = useState<CityCounts | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const bySlug = useMemo(() => new Map(cities.map((c) => [c.slug, c])), [cities]);
  // Deep links: ?city=lyon preselects a city, ?ref=code credits the inviter.
  const cityFromUrl = searchParams.get("city") ?? "";
  const selection: CitySelection | null = chosen ?? (bySlug.has(cityFromUrl) ? { kind: "city", slug: cityFromUrl } : null);
  const city = selection?.kind === "city" ? selection.slug : "";
  const requested = selection?.kind === "request" ? selection.name : "";
  const ref = readReferral(searchParams.toString());
  const selected = bySlug.get(city);
  const rival = selected?.rivalSlug ? bySlug.get(selected.rivalSlug) : undefined;
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const isOpen = endpoint.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void fetchCityCounts(endpoint).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, isOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Honeypot: real people never see or fill this field.
    if (String(form.get("company") ?? "").length > 0) return;

    setStatus({ kind: "submitting" });
    const fanbase = String(form.get("fanbase") ?? "").trim();
    const result = await submitSignup(endpoint, {
      email: String(form.get("email") ?? "").trim(),
      ...(city ? { city } : { requestedCity: requested }),
      ...(fanbase ? { fanbase } : {}),
      ...(ref ? { ref } : {}),
      locale,
      consent: form.get("consent") === "on",
    });
    setStatus(result.ok ? { kind: "success", data: result.data } : { kind: "error", code: result.error });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* City picker + rival race */}
      <div className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
        <CitySearch
          cities={cities}
          countryLabels={countryLabels}
          dict={dict.form}
          selectedName={selected?.name ?? requested}
          onSelect={setChosen}
        />

        <div className="mt-6 space-y-3" aria-live="polite">
          {selected ? (
            <>
              <CityRace name={selected.name} threshold={selected.threshold} count={counts?.[selected.slug]} nf={nf} dict={dict} highlight />
              {rival && (
                <>
                  <p className="text-center font-mono text-xs tracking-[0.2em] text-faint uppercase">{dict.form.rivalLabel}</p>
                  <CityRace name={rival.name} threshold={rival.threshold} count={counts?.[rival.slug]} nf={nf} dict={dict} />
                </>
              )}
              {!counts && <p className="text-sm text-faint">{dict.form.counterPending}</p>}
            </>
          ) : requested ? (
            <div className="rounded-2xl border border-volt/40 bg-volt/5 p-4">
              <p className="font-display text-lg font-semibold">{format(dict.form.requestedTitle, { city: requested })}</p>
              <p className="mt-1 text-sm text-muted">{dict.form.requestedBody}</p>
            </div>
          ) : (
            <p className="text-sm text-faint">{dict.body}</p>
          )}
        </div>
      </div>

      {/* Form / closed / success */}
      <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
        {status.kind === "success" ? (
          <Success
            data={status.data}
            city={selected?.name ?? requested}
            citySlug={city}
            dict={dict.success}
            locale={locale}
            siteUrl={siteUrl}
          />
        ) : isOpen ? (
          <form id="waitlist" onSubmit={onSubmit} className="space-y-5">
            <Field id="wl-email" label={dict.form.email}>
              <input
                id="wl-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                placeholder={dict.form.emailPlaceholder}
                className={inputClass}
              />
            </Field>
            <Field id="wl-fanbase" label={dict.form.fanbase}>
              <input
                id="wl-fanbase"
                name="fanbase"
                type="text"
                maxLength={60}
                placeholder={dict.form.fanbasePlaceholder}
                className={inputClass}
              />
            </Field>
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="wl-company">Company</label>
              <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input name="consent" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-pulse" />
              <span>
                {dict.form.consent}{" "}
                <a href={privacyHref} className="text-text underline decoration-line underline-offset-4 hover:decoration-pulse">
                  {dict.form.privacy}
                </a>
              </span>
            </label>
            {status.kind === "error" && (
              <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
                {dict.errors[status.code]}
              </p>
            )}
            <button type="submit" disabled={status.kind === "submitting" || !selection} className={buttonClass("primary", "w-full")}>
              {status.kind === "submitting" ? dict.form.submitting : dict.form.submit}
            </button>
          </form>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <h3 className="font-display text-2xl font-semibold">{dict.closed.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{format(dict.closed.body, { handle: social.xHandle })}</p>
            <a href={social.x} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "mt-6 w-full sm:w-auto")}>
              {dict.closed.cta} {social.xHandle}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-night px-4 text-text placeholder:text-faint outline-none transition-colors focus:border-pulse";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-display text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function CityRace(props: {
  name: string;
  threshold: number;
  count: number | undefined;
  nf: Intl.NumberFormat;
  dict: Dictionary["unlock"];
  highlight?: boolean;
}) {
  const progress = props.count === undefined ? null : unlockProgress(props.count, props.threshold);
  return (
    <div className={cn("rounded-2xl border p-4", props.highlight ? "border-pulse/40 bg-pulse/5" : "border-line bg-night/60")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-semibold">{props.name}</p>
        <p className="font-mono text-xs text-muted">
          {progress ? (
            <>
              <span className="text-text">{props.nf.format(props.count ?? 0)}</span> / {props.nf.format(props.threshold)}{" "}
              {props.dict.form.counterLive}
            </>
          ) : (
            <>
              <span className="text-volt">{props.nf.format(props.threshold)}</span> {props.dict.form.threshold.toLowerCase()}
            </>
          )}
        </p>
      </div>
      {progress && (
        <div
          className="stripe-bar mt-3 h-2.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={props.threshold}
          aria-valuenow={props.count}
          aria-label={props.name}
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", props.highlight ? "bg-pulse" : "bg-calm")}
            style={{ width: `${Math.round(progress.fraction * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Success(props: {
  data: SignupResponse;
  city: string;
  citySlug: string;
  dict: Dictionary["unlock"]["success"];
  locale: Locale;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = referralUrl(props.siteUrl, props.locale, props.data.referralCode, props.citySlug);
  const shareText = format(props.dict.shareText, { city: props.city });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div role="status">
      <h3 className="font-display text-2xl font-semibold">{props.dict.title}</h3>
      <p className="mt-3 text-muted">{format(props.dict.rank, { rank: props.data.cityRank, city: props.city })}</p>
      {props.data.tier && (
        <p className="mt-4 inline-flex rounded-full border border-volt/40 bg-volt/10 px-3 py-1 font-mono text-xs tracking-[0.15em] text-volt uppercase">
          {props.dict.tier[props.data.tier]}
        </p>
      )}
      {props.data.pendingVerification && <p className="mt-4 text-sm text-muted">{props.dict.pending}</p>}

      <p className="mt-6 font-display text-sm font-semibold">{props.dict.referralLabel}</p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={link}
          aria-label={props.dict.referralLabel}
          className={cn(inputClass, "font-mono text-xs")}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy} className={buttonClass("ghost", "shrink-0")}>
          {copied ? props.dict.copied : props.dict.copy}
        </button>
      </div>
      <a href={xShareUrl(shareText, link)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "mt-4 w-full")}>
        {props.dict.shareX}
      </a>
    </div>
  );
}
