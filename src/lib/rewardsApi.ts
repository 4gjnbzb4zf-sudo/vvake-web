import * as z from "zod/mini";
import { ClaimRefusedError } from "./claimTx";
import { VAULT_FIELDS, type VaultBlob } from "./walletVault";

/**
 * The VVake API calls of vvake.com/rewards (contract: monorepo docs/05-tech/api-v1.md, "Auth" and "Rewards").
 *
 * Signing in on the web reuses what the API already has, no new route:
 * - an e-mail code (POST /v1/auth/email/start + /verify), for accounts that use that e-mail;
 * - the app's one-time device link code (POST /v1/auth/link/redeem, 2 minutes, signed-in accounts only), for
 *   everyone else (Sign in with Apple with a hidden e-mail, Google).
 * Both register this browser as a device named "Web (vvake.com)" that can be removed from the app.
 *
 * Tokens: the 15-minute access token stays in memory; the refresh token (rotated on every use) in sessionStorage,
 * so a reload keeps you signed in and closing the tab signs you out of this browser's session.
 */

const REFRESH_KEY = "vvake-rewards-refresh";
const DEVICE_KEY = "vvake-web-device";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const userSchema = z.object({ id: z.string(), name: z.optional(z.nullable(z.string())), email: z.optional(z.nullable(z.string())) });
const tokenPairSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), user: userSchema });
export type SessionUser = z.infer<typeof userSchema>;

const STATUSES = ["pending", "claimable", "claimed", "expired", "closed"] as const;
export type EpochStatus = (typeof STATUSES)[number];

/**
 * Prize eligibility of one week (Plus active, a wallet linked, 18+ confirmed, enough effort). Optional: older API
 * versions don't send it, and a malformed value is dropped rather than failing the whole page.
 */
const eligibleField = z.optional(z.catch(z.nullable(z.boolean()), null));
const missingField = z.optional(z.catch(z.nullable(z.array(z.string())), null));

/** What keeps a week from counting, as the page explains it. Unknown codes from a newer API fall back to "other". */
export type MissingCondition = "plus" | "wallet" | "adult" | "effort" | "other";

export function missingConditions(codes: readonly string[] | null | undefined): MissingCondition[] {
  const out = new Set<MissingCondition>();
  for (const raw of codes ?? []) {
    const c = raw.toLowerCase();
    if (c.includes("plus") || c.includes("subscri")) out.add("plus");
    else if (c.includes("wallet")) out.add("wallet");
    else if (/adult|\bage\b|18/.test(c)) out.add("adult");
    else if (c.includes("effort") || c.includes("session") || c.includes("minute") || c.includes("activ")) out.add("effort");
    else out.add("other");
  }
  return [...out];
}

const rewardsSchema = z.object({
  enabled: z.boolean(),
  network: z.optional(z.string()),
  chainId: z.optional(z.number()),
  contract: z.optional(z.nullable(z.string())),
  explorerUrl: z.optional(z.string()),
  rate: z.optional(z.object({ vvakePerPoint: z.string(), dailyPointCap: z.number(), maxPerEpoch: z.string() })),
  wallet: z.optional(z.nullable(z.object({ address: z.string(), linkedAt: z.string() }))),
  week: z.optional(
    z.object({
      epoch: z.number(),
      startsAt: z.string(),
      endsAt: z.string(),
      points: z.number(),
      estimatedVvake: z.string(),
      eligible: eligibleField,
      missing: missingField,
    }),
  ),
  epochs: z.optional(
    z.array(
      z.object({
        epoch: z.number(),
        startsAt: z.string(),
        endsAt: z.string(),
        points: z.number(),
        amount: z.string(),
        amountBase: z.string(),
        address: z.string(),
        status: z.catch(z.enum(STATUSES), "pending"),
        deadline: z.nullable(z.string()),
        eligible: eligibleField,
        missing: missingField,
      }),
    ),
  ),
});
export type Rewards = z.infer<typeof rewardsSchema>;
export type RewardEpoch = NonNullable<Rewards["epochs"]>[number];

const proofSchema = z.object({
  epoch: z.number(),
  chainId: z.number(),
  contract: z.nullable(z.string()),
  account: z.string(),
  amount: z.string(),
  amountBase: z.string(),
  proof: z.array(z.string()),
  status: z.catch(z.enum(STATUSES), "pending"),
  calldata: z.string(),
});
export type Proof = z.infer<typeof proofSchema>;

const challengeSchema = z.object({ message: z.string(), nonce: z.string(), expiresAt: z.string() });
/** The passkey wallet's encrypted blob (GET/PUT /v1/rewards/vault); checked field by field before use (isVaultBlob). */
const vaultBlobSchema = z.object({
  version: z.literal(1),
  credentialId: z.string(),
  salt: z.string(),
  iv: z.string(),
  ciphertext: z.string(),
  address: z.string(),
  createdAt: z.optional(z.string()),
});
const vaultSchema = z.object({ vault: z.nullable(vaultBlobSchema) });
export type StoredVault = z.infer<typeof vaultBlobSchema>;
const walletSchema = z.object({ wallet: z.object({ address: z.string(), linkedAt: z.string() }) });

const publicEpochSchema = z.object({
  epoch: z.number(),
  startsAt: z.string(),
  endsAt: z.string(),
  chainId: z.number(),
  contract: z.nullable(z.string()),
  root: z.nullable(z.string()),
  total: z.nullable(z.string()),
  status: z.string(),
  claims: z.array(z.object({ account: z.string(), amount: z.string() })),
});
export type PublicEpoch = z.infer<typeof publicEpochSchema>;

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A stable, random id for this browser (the API's device id: 8–64 letters, digits, . _ -). */
function deviceId(): string {
  const store = storage("local");
  let id: string | null = null;
  try {
    id = store?.getItem(DEVICE_KEY) ?? null;
  } catch {
    id = null;
  }
  if (id && /^web-[0-9a-f]{24}$/.test(id)) return id;
  id = "web-" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
  try {
    store?.setItem(DEVICE_KEY, id);
  } catch {
    // private mode: a new id next time, which only means another device row
  }
  return id;
}

// The API only knows "phone" and "watch" devices; a browser signs in as a phone-kind device named for the web.
const device = () => ({ id: deviceId(), kind: "phone" as const, model: "Web (vvake.com)" });

async function request<T>(apiUrl: string, path: string, init: RequestInit, schema: z.ZodMiniType<T> | null, token?: string): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network", "network");
  }
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const j = (json ?? {}) as { error?: unknown; message?: unknown };
    throw new ApiError(res.status, typeof j.error === "string" ? j.error : "error", typeof j.message === "string" ? j.message : "");
  }
  if (!schema) return json as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(res.status, "bad_response", "bad_response");
  return parsed.data;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/**
 * Refresh tokens rotate on every use and reusing an old one revokes the whole device (theft detection), so two
 * refreshes with the same token (two calls hitting a 401 at once, React's dev double effects) must share one request.
 */
const refreshing = new Map<string, Promise<z.infer<typeof tokenPairSchema>>>();
function refreshOnce(apiUrl: string, refreshToken: string) {
  let p = refreshing.get(refreshToken);
  if (!p) {
    p = request(apiUrl, "/v1/auth/refresh", post({ refreshToken }), tokenPairSchema);
    refreshing.set(refreshToken, p);
    p.catch(() => undefined).finally(() => window.setTimeout(() => refreshing.delete(refreshToken), 30_000));
  }
  return p;
}

/** One signed-in session against the API: refreshes the access token once on a 401. */
export class RewardsSession {
  private access: string | null = null;
  user: SessionUser | null = null;

  constructor(private readonly apiUrl: string) {}

  /** Whether this tab holds a refresh token from an earlier sign-in. */
  static hasStored(): boolean {
    try {
      return Boolean(storage("session")?.getItem(REFRESH_KEY));
    } catch {
      return false;
    }
  }

  private keep(pair: z.infer<typeof tokenPairSchema>) {
    this.access = pair.accessToken;
    this.user = pair.user;
    try {
      storage("session")?.setItem(REFRESH_KEY, pair.refreshToken);
    } catch {
      // not kept: signed in until the page is closed or reloaded
    }
  }

  private forget() {
    this.access = null;
    this.user = null;
    try {
      storage("session")?.removeItem(REFRESH_KEY);
    } catch {
      // nothing stored
    }
  }

  startEmail(email: string) {
    return request(this.apiUrl, "/v1/auth/email/start", post({ email }), null);
  }

  async verifyEmail(email: string, code: string) {
    this.keep(await request(this.apiUrl, "/v1/auth/email/verify", post({ email, code, device: device() }), tokenPairSchema));
  }

  async redeemAppCode(code: string) {
    const clean = code.toUpperCase().replace(/[\s-]/g, "");
    this.keep(await request(this.apiUrl, "/v1/auth/link/redeem", post({ code: clean, device: device() }), tokenPairSchema));
  }

  /** Uses the stored refresh token; false when there is none or it no longer works. */
  async resume(): Promise<boolean> {
    let refreshToken: string | null = null;
    try {
      refreshToken = storage("session")?.getItem(REFRESH_KEY) ?? null;
    } catch {
      refreshToken = null;
    }
    if (!refreshToken) return false;
    try {
      this.keep(await refreshOnce(this.apiUrl, refreshToken));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.forget();
      return false;
    }
  }

  async signOut() {
    let refreshToken: string | null = null;
    try {
      refreshToken = storage("session")?.getItem(REFRESH_KEY) ?? null;
    } catch {
      refreshToken = null;
    }
    this.forget();
    if (refreshToken) await request(this.apiUrl, "/v1/auth/logout", post({ refreshToken }), null).catch(() => undefined);
  }

  private async authed<T>(path: string, init: RequestInit, schema: z.ZodMiniType<T> | null): Promise<T> {
    if (!this.access && !(await this.resume())) throw new ApiError(401, "unauthorized", "");
    try {
      return await request(this.apiUrl, path, init, schema, this.access!);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401 || !(await this.resume())) throw e;
      return request(this.apiUrl, path, init, schema, this.access!);
    }
  }

  rewards() {
    return this.authed("/v1/rewards", { method: "GET" }, rewardsSchema);
  }

  proof(epoch: number) {
    return this.authed(`/v1/rewards/proof?epoch=${epoch}`, { method: "GET" }, proofSchema);
  }

  walletChallenge(address: string) {
    return this.authed("/v1/rewards/wallet/challenge", post({ address }), challengeSchema);
  }

  /** `adult`: the visitor ticked "I'm 18 or older" on the page; the API requires it to link a wallet. */
  linkWallet(nonce: string, signature: string, adult: boolean) {
    return this.authed("/v1/rewards/wallet", post(adult ? { nonce, signature, adult: true } : { nonce, signature }), walletSchema);
  }

  unlinkWallet() {
    return this.authed("/v1/rewards/wallet", { method: "DELETE" }, null);
  }

  /** The passkey wallet's encrypted blob, or null. */
  async vault(): Promise<StoredVault | null> {
    return (await this.authed("/v1/rewards/vault", { method: "GET" }, vaultSchema)).vault;
  }

  /** Stores the encrypted blob: exactly the six vault fields (VAULT_FIELDS), nothing else is ever sent. */
  async saveVault(blob: VaultBlob): Promise<StoredVault> {
    const only = Object.fromEntries(VAULT_FIELDS.map((k) => [k, blob[k]]));
    const res = await this.authed("/v1/rewards/vault", { method: "PUT", body: JSON.stringify(only) }, vaultSchema);
    if (!res.vault) throw new ApiError(500, "bad_response", "bad_response");
    return res.vault;
  }

  deleteVault() {
    return this.authed("/v1/rewards/vault", { method: "DELETE" }, null);
  }
}

/** GET /v1/rewards/epochs/:n (public): one week's whole tree, or null when that week wasn't built. */
export async function publicEpoch(apiUrl: string, epoch: number): Promise<PublicEpoch | null> {
  try {
    return await request(apiUrl, `/v1/rewards/epochs/${epoch}`, { method: "GET" }, publicEpochSchema);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** The app's device link code: 8 characters (no 0/O, 1/I), with or without a dash or spaces. */
export const APP_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
export const isAppCode = (raw: string) => APP_CODE.test(raw.toUpperCase().replace(/[\s-]/g, ""));
export const isEmailCode = (raw: string) => /^\d{6}$/.test(raw.trim());

export type ErrorKey =
  | "wrongCode"
  | "expired"
  | "tooMany"
  | "guest"
  | "walletTaken"
  | "walletRefused"
  | "signatureMismatch"
  | "notFound"
  | "network"
  | "claimRefused"
  | "passkeyCancelled"
  | "passkeyLocked"
  | "prfUnsupported"
  | "needsGas"
  | "linkRefused"
  | "vaultTaken"
  | "generic";

/** Which message to show for an API or wallet error (the API's own messages are English only). */
export function errorKey(e: unknown): ErrorKey {
  if (e instanceof ClaimRefusedError) return "claimRefused";
  // The passkey wallet (src/lib/walletVault.ts, passkeyWallet.ts) and WebAuthn itself (a closed prompt).
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "AbortError") return "passkeyCancelled";
  if (name === "VaultLockedError") return "passkeyLocked";
  if (name === "PrfUnsupportedError") return "prfUnsupported";
  if (name === "NeedsGasError") return "needsGas";
  if (name === "LinkRefusedError") return "linkRefused";
  if (e && typeof e === "object" && "code" in e && Number((e as { code: unknown }).code) === 4001) return "walletRefused";
  if (!(e instanceof ApiError)) return "generic";
  if (e.code === "network") return "network";
  if (e.status === 429) return "tooMany";
  if (e.status === 403) return "guest";
  if (e.status === 409) return "walletTaken";
  if (e.status === 404) return "notFound";
  if (e.status === 401) return /wrong/i.test(e.message) ? "wrongCode" : "expired";
  if (e.status === 400 && /signature/i.test(e.message)) return "signatureMismatch";
  if (e.status === 400 && /expired/i.test(e.message)) return "expired";
  return "generic";
}
