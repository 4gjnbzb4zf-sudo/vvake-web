import * as z from "zod/mini";
import { locales } from "@/i18n/config";
import { CITY_SLUGS } from "./cities";

/**
 * Optional "which wearable do you use?" answer (helps decide which integrations come first).
 * Not a promise of support: see the device status on the home page.
 */
export const WEARABLES = ["apple-watch", "wear-os", "garmin", "ring", "other", "none"] as const;
export type Wearable = (typeof WEARABLES)[number];

/**
 * Request body for POST {endpoint}/signup. Contract: docs/WAITLIST_API.md.
 * Written with `zod/mini` (tree-shakable): the same rules as before at a fraction of the bundle size,
 * since this ships to every page with the signup form.
 */
export const signupInputSchema = z
  .object({
    email: z.email().check(z.maxLength(254)),
    /** A launch city slug… */
    city: z.optional(z.enum(CITY_SLUGS)),
    /** …or a free-text request for a city that isn't on the list yet ("Grenoble, France"). */
    requestedCity: z.optional(z.string().check(z.trim(), z.minLength(2), z.maxLength(80))),
    fanbase: z.optional(z.string().check(z.trim(), z.maxLength(60))),
    /** Optional: the wearable the person uses (or "none"). */
    wearable: z.optional(z.enum(WEARABLES)),
    ref: z.optional(z.string().check(z.regex(/^[a-z0-9]{6,12}$/))),
    locale: z.enum(locales),
    consent: z.literal(true),
    /** Cloudflare Turnstile token (bot check), when the check is on. */
    turnstileToken: z.optional(z.string().check(z.maxLength(2048))),
  })
  .check(
    z.refine((v) => (v.city === undefined) !== (v.requestedCity === undefined), {
      message: "Provide exactly one of city or requestedCity",
    }),
  );
export type SignupInput = z.infer<typeof signupInputSchema>;

/** Unvalidated form values; `submitSignup` validates them against `signupInputSchema`. */
export interface SignupDraft {
  email: string;
  city?: string;
  requestedCity?: string;
  fanbase?: string;
  wearable?: string;
  ref?: string;
  locale: string;
  consent: boolean;
  turnstileToken?: string;
}

export const signupResponseSchema = z.object({
  referralCode: z.string().check(z.regex(/^[a-z0-9]{6,12}$/)),
  cityRank: z.int().check(z.positive()),
  citySignups: z.int().check(z.nonnegative()),
  /** Reserved tier; activates after 3 real sessions (ADR-0007). */
  tier: z.nullable(z.enum(["founder", "pioneer", "early"])),
  /** True when the email still needs to be verified. */
  pendingVerification: z.boolean(),
  /** "code": a 6-digit code was emailed, type it in the form · "later": the email follows · "done": verified. */
  verification: z.optional(z.enum(["code", "later", "done"])),
});
export type SignupResponse = z.infer<typeof signupResponseSchema>;

/** GET {endpoint}/cities → confirmed signups per city slug. */
export const cityCountsSchema = z.record(z.string(), z.int().check(z.nonnegative()));
export type CityCounts = z.infer<typeof cityCountsSchema>;

export type SignupResult =
  | { ok: true; data: SignupResponse }
  | { ok: false; error: "not-configured" | "invalid" | "rate-limited" | "network" | "server" | "bot" | "wrong-code" | "expired" };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function submitSignup(endpoint: string, input: SignupDraft, fetchImpl: FetchLike = fetch): Promise<SignupResult> {
  if (!endpoint) return { ok: false, error: "not-configured" };
  const parsed = signupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  let res: Response;
  try {
    res = await fetchImpl(`${endpoint}/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  return readResult(res);
}

/** POST {endpoint}/verify: the 6-digit code from the email. */
export async function verifyCode(endpoint: string, email: string, code: string, fetchImpl: FetchLike = fetch): Promise<SignupResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${endpoint}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  return readResult(res);
}

async function readResult(res: Response): Promise<SignupResult> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.status === 429) return { ok: false, error: "rate-limited" };
  if (res.status === 403 && json?.error === "bot") return { ok: false, error: "bot" };
  if (res.status === 410) return { ok: false, error: "expired" };
  if (res.status === 422 && json?.error === "wrong-code") return { ok: false, error: "wrong-code" };
  if (res.status === 400 || res.status === 422) return { ok: false, error: "invalid" };
  if (!res.ok) return { ok: false, error: "server" };
  const body = signupResponseSchema.safeParse(json);
  return body.success ? { ok: true, data: body.data } : { ok: false, error: "server" };
}

export async function fetchCityCounts(endpoint: string, fetchImpl: FetchLike = fetch): Promise<CityCounts | null> {
  if (!endpoint) return null;
  try {
    const res = await fetchImpl(`${endpoint}/cities`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = cityCountsSchema.safeParse(await res.json());
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
