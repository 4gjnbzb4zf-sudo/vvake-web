"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CitySearch, type CitySelection } from "./CitySearch";
import { buttonClass, inputClass } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import type { Country } from "@/lib/cities";
import { cn } from "@/lib/cn";
import { readReferral } from "@/lib/referral";
import { unlockProgress } from "@/lib/unlock";
import {
  fetchCityCounts,
  submitSignup,
  verifyCode,
  type CityCounts,
  type SignupDraft,
  type SignupResponse,
  type SignupResult,
  WEARABLES,
} from "@/lib/waitlist";
import { Turnstile } from "@/components/ui/Turnstile";

/**
 * The success panel (invite link, share buttons, story card, invite ladder) pulls in the VVaker preferences and the
 * story-card renderer: loaded only once someone has actually signed up, so the page itself ships less JavaScript.
 */
const Success = dynamic(() => import("./WaitlistSuccess").then((m) => m.WaitlistSuccess), {
  loading: () => <p className="text-muted">…</p>,
});

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
  /** Cloudflare Turnstile site key; empty = no bot check widget. */
  turnstileSiteKey: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "code"; email: string; draft: SignupDraft; verifying?: boolean; note?: "resent"; error?: SignupErrorCode }
  | { kind: "success"; data: SignupResponse }
  | { kind: "error"; code: Extract<SignupResult, { ok: false }>["error"] };

type SignupErrorCode = Extract<SignupResult, { ok: false }>["error"];

export function WaitlistForm({
  locale,
  dict,
  countryLabels,
  cities,
  endpoint,
  siteUrl,
  privacyHref,
  social,
  turnstileSiteKey,
}: WaitlistFormProps) {
  const searchParams = useSearchParams();
  const [chosen, setChosen] = useState<CitySelection | null>(null);
  const [counts, setCounts] = useState<CityCounts | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [human, setHuman] = useState("");

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
    const wearable = String(form.get("wearable") ?? "");
    const draft: SignupDraft = {
      email: String(form.get("email") ?? "").trim(),
      ...(city ? { city } : { requestedCity: requested }),
      ...(fanbase ? { fanbase } : {}),
      ...(wearable ? { wearable } : {}),
      ...(ref ? { ref } : {}),
      locale,
      consent: form.get("consent") === "on",
      ...(human ? { turnstileToken: human } : {}),
    };
    const result = await submitSignup(endpoint, draft);
    if (!result.ok) return setStatus({ kind: "error", code: result.error });
    // A code went to the inbox: verify it here before counting the signup.
    if (result.data.verification === "code") return setStatus({ kind: "code", email: draft.email, draft });
    setStatus({ kind: "success", data: result.data });
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind !== "code") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
    setStatus({ ...status, verifying: true, note: undefined, error: undefined });
    const result = await verifyCode(endpoint, status.email, code);
    setStatus(result.ok ? { kind: "success", data: result.data } : { ...status, verifying: false, error: result.error });
  }

  async function resendCode() {
    if (status.kind !== "code") return;
    const result = await submitSignup(endpoint, status.draft);
    setStatus(result.ok ? { ...status, note: "resent", error: undefined } : { ...status, error: result.error });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* City picker + rival race */}
      <div className="rounded-3xl border border-line bg-surface/60 p-6 sm:p-8">
        <p className="mb-4 font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">{dict.form.step1}</p>
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
            <div className="rounded-2xl border border-volt-fg/40 bg-volt/5 p-4">
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
        ) : status.kind === "code" ? (
          <form key="code" onSubmit={onVerify} className="space-y-5">
            <div>
              <h3 className="font-display text-2xl font-semibold">{dict.code.title}</h3>
              <p className="mt-2 text-muted">{format(dict.code.body, { email: status.email })}</p>
            </div>
            <Field id="wl-code" label={dict.code.label}>
              <input
                id="wl-code"
                name="code"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                placeholder="000000"
                className={cn(inputClass, "text-center font-mono text-2xl tracking-[0.4em]")}
              />
            </Field>
            {status.error && (
              <p role="alert" className="rounded-xl border border-down-fg/40 bg-down/10 px-4 py-3 text-sm text-down-fg">
                {dict.errors[status.error]}
              </p>
            )}
            {status.note === "resent" && <p className="text-sm text-up-fg">{dict.code.resent}</p>}
            <button type="submit" disabled={status.verifying} className={buttonClass("primary", "w-full")}>
              {status.verifying ? dict.code.verifying : dict.code.submit}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={resendCode} className="text-muted underline underline-offset-4 hover:text-text">
                {dict.code.resend}
              </button>
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="text-muted underline underline-offset-4 hover:text-text"
              >
                {dict.code.changeEmail}
              </button>
            </div>
          </form>
        ) : isOpen ? (
          <form key="signup" id="waitlist" onSubmit={onSubmit} className="space-y-5">
            <div>
              <p className="font-mono text-xs tracking-[0.16em] text-pulse-fg uppercase">
                {selection ? format(dict.form.step2, { city: selected?.name ?? requested }) : dict.form.step2Empty}
              </p>
              <p className="mt-2 text-sm text-muted">{dict.form.signupIntro}</p>
            </div>
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
            <Field id="wl-wearable" label={dict.form.wearable}>
              <select id="wl-wearable" name="wearable" defaultValue="" className={cn(inputClass, "appearance-auto")}>
                <option value="">{dict.form.wearableSkip}</option>
                {WEARABLES.map((w) => (
                  <option key={w} value={w}>
                    {dict.form.wearables[w]}
                  </option>
                ))}
              </select>
            </Field>
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted hover:text-text">{dict.form.addTeam}</summary>
              <div className="mt-3">
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
              </div>
            </details>
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="wl-company">Company</label>
              <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input name="consent" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-pulse-fg" />
              <span>
                {dict.form.consent}{" "}
                <a href={privacyHref} className="text-text underline decoration-line underline-offset-4 hover:decoration-pulse-fg">
                  {dict.form.privacy}
                </a>
              </span>
            </label>
            {status.kind === "error" && (
              <p role="alert" className="rounded-xl border border-down-fg/40 bg-down/10 px-4 py-3 text-sm text-down-fg">
                {dict.errors[status.code]}
              </p>
            )}
            {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setHuman} />}
            <button
              type="submit"
              disabled={status.kind === "submitting" || !selection || (turnstileSiteKey !== "" && !human)}
              className={buttonClass("primary", "w-full")}
            >
              {status.kind === "submitting"
                ? dict.form.submitting
                : selection
                  ? format(dict.form.submitCity, { city: selected?.name ?? requested })
                  : dict.form.submitNoCity}
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
    <div className={cn("rounded-2xl border p-4", props.highlight ? "border-pulse-fg/40 bg-pulse/5" : "border-line bg-night/60")}>
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
              <span className="text-volt-fg">{props.nf.format(props.threshold)}</span> {props.dict.form.threshold.toLowerCase()}
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
