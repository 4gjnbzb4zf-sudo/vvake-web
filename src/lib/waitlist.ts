import { z } from "zod";
import { locales } from "@/i18n/config";
import { CITY_SLUGS } from "./cities";

/** Request body for POST {endpoint}/signup. Contract: docs/WAITLIST_API.md. */
export const signupInputSchema = z
  .object({
    email: z.email().max(254),
    /** A launch city slug… */
    city: z.enum(CITY_SLUGS).optional(),
    /** …or a free-text request for a city that isn't on the list yet ("Grenoble, France"). */
    requestedCity: z.string().trim().min(2).max(80).optional(),
    fanbase: z.string().trim().max(60).optional(),
    ref: z
      .string()
      .regex(/^[a-z0-9]{6,12}$/)
      .optional(),
    locale: z.enum(locales),
    consent: z.literal(true),
  })
  .refine((v) => (v.city === undefined) !== (v.requestedCity === undefined), {
    message: "Provide exactly one of city or requestedCity",
  });
export type SignupInput = z.infer<typeof signupInputSchema>;

/** Unvalidated form values; `submitSignup` validates them against `signupInputSchema`. */
export interface SignupDraft {
  email: string;
  city?: string;
  requestedCity?: string;
  fanbase?: string;
  ref?: string;
  locale: string;
  consent: boolean;
}

export const signupResponseSchema = z.object({
  referralCode: z.string().regex(/^[a-z0-9]{6,12}$/),
  cityRank: z.number().int().positive(),
  citySignups: z.number().int().nonnegative(),
  /** Reserved tier; activates after 3 real sessions (ADR-0007). */
  tier: z.enum(["founder", "pioneer", "early"]).nullable(),
  /** True when the email still needs to be confirmed via the link we sent. */
  pendingVerification: z.boolean(),
});
export type SignupResponse = z.infer<typeof signupResponseSchema>;

/** GET {endpoint}/cities → confirmed signups per city slug. */
export const cityCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type CityCounts = z.infer<typeof cityCountsSchema>;

export type SignupResult =
  { ok: true; data: SignupResponse } | { ok: false; error: "not-configured" | "invalid" | "rate-limited" | "network" | "server" };

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
  if (res.status === 429) return { ok: false, error: "rate-limited" };
  if (res.status === 400 || res.status === 422) return { ok: false, error: "invalid" };
  if (!res.ok) return { ok: false, error: "server" };

  const body = signupResponseSchema.safeParse(await res.json().catch(() => null));
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
