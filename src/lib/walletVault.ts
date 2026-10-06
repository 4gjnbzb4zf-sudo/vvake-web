import { bytesToHex, generatePrivateKey, privateKeyToAddress, wipe } from "./walletKeys";

/**
 * The passkey wallet's vault (vvake.com/rewards, founder decision 2026-10-06: open source, no wallet service).
 *
 * - A secp256k1 key is generated in the browser (CSPRNG). A passkey is created for vvake.com with the WebAuthn PRF
 *   extension; PRF(salt) is a 32-byte secret only that passkey can produce, after Face ID / Touch ID / the device PIN.
 * - AES-256-GCM key = HKDF-SHA-256(PRF output, salt, "vvake-wallet-v1"); the private key is encrypted with it, the
 *   address is bound as additional data. Only { version, credentialId, salt, iv, ciphertext, address } is stored on
 *   VVake's servers (PUT /v1/rewards/vault): useless without the passkey. The API never sees the key or the PRF output.
 * - To sign, the page fetches the blob, asks the passkey again (user verification required), derives, decrypts in
 *   memory, signs, and zeroes the key and the PRF output (withPrivateKey).
 * - No PRF (some browsers / authenticators): no wallet. There is deliberately no weaker fallback (a password, a key
 *   kept in localStorage…); the page offers "use my own wallet" instead.
 *
 * Every WebAuthn call goes through a PasskeyApi (navigator.credentials in the browser, a software passkey in tests).
 */

export const VAULT_VERSION = 1 as const;
export const VAULT_INFO = "vvake-wallet-v1";
/** The only fields that ever leave the browser. */
export const VAULT_FIELDS = ["version", "credentialId", "salt", "iv", "ciphertext", "address"] as const;
/** How long the export warning stays up before the key can be revealed. */
export const EXPORT_WARNING_MS = 10_000;

export interface VaultBlob {
  version: typeof VAULT_VERSION;
  /** base64url of the passkey's raw credential id. */
  credentialId: string;
  /** base64url, 32 bytes: the PRF input and the HKDF salt. */
  salt: string;
  /** base64url, 12 bytes: the AES-GCM nonce. */
  iv: string;
  /** base64url, 48 bytes: the encrypted 32-byte key and the 16-byte GCM tag. */
  ciphertext: string;
  /** The wallet's address (EIP-55). */
  address: string;
}

export type PasskeyApi = Pick<CredentialsContainer, "create" | "get">;

export class PrfUnsupportedError extends Error {
  constructor() {
    super("This passkey can't protect a wallet (no WebAuthn PRF)");
    this.name = "PrfUnsupportedError";
  }
}

/** The vault can't be opened: another passkey, a tampered blob, or a cancelled prompt that returned nothing. */
export class VaultLockedError extends Error {
  constructor() {
    super("This passkey can't open the wallet");
    this.name = "VaultLockedError";
  }
}

export class ExportTooSoonError extends Error {
  constructor() {
    super("Read the warning first");
    this.name = "ExportTooSoonError";
  }
}

// ── base64url ───────────────────────────────────────────────────────────────────────────────────────────────

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new TypeError("bad base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
/** WebCrypto wants BufferSource backed by an ArrayBuffer: a plain copy keeps TypeScript and every engine happy. */
const buf = (b: Uint8Array) => new Uint8Array(b) as Uint8Array<ArrayBuffer>;

/** The WebAuthn relying party for this host: vvake.com (and its subdomains), localhost in development, else none. */
export function passkeyRpId(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (h === "vvake.com" || h.endsWith(".vvake.com")) return "vvake.com";
  if (h === "localhost") return "localhost";
  return null;
}

/** A blob as the API returns it, checked field by field (lengths included). */
export function isVaultBlob(x: unknown): x is VaultBlob {
  if (!x || typeof x !== "object") return false;
  const v = x as Record<string, unknown>;
  const len = (s: unknown, n: number) => {
    try {
      return typeof s === "string" && fromB64url(s).length === n;
    } catch {
      return false;
    }
  };
  return (
    v.version === VAULT_VERSION &&
    typeof v.credentialId === "string" &&
    /^[A-Za-z0-9_-]{16,1366}$/.test(v.credentialId) &&
    len(v.salt, 32) &&
    len(v.iv, 12) &&
    len(v.ciphertext, 48) &&
    typeof v.address === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(v.address)
  );
}

// ── Encryption ──────────────────────────────────────────────────────────────────────────────────────────────

async function vaultKey(prf: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", buf(prf), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: utf8(VAULT_INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false, // never extractable
    ["encrypt", "decrypt"],
  );
}

const aad = (address: string) => utf8(`${VAULT_INFO}|${address}`);

/** Encrypts `key` under the PRF output. A fresh random IV every time. Doesn't wipe its inputs (the caller does). */
export async function sealPrivateKey(input: {
  key: Uint8Array;
  prf: Uint8Array;
  salt: Uint8Array;
  credentialId: string;
}): Promise<VaultBlob> {
  const address = privateKeyToAddress(input.key);
  const iv = random(12);
  const aes = await vaultKey(input.prf, input.salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(address) }, aes, buf(input.key)));
  return {
    version: VAULT_VERSION,
    credentialId: input.credentialId,
    salt: b64url(input.salt),
    iv: b64url(iv),
    ciphertext: b64url(ct),
    address,
  };
}

/** Decrypts the key (AES-GCM checks the tag: another PRF output, IV, salt or address fails) and checks its address. */
export async function openPrivateKey(blob: VaultBlob, prf: Uint8Array): Promise<Uint8Array> {
  if (!isVaultBlob(blob)) throw new VaultLockedError();
  let key: Uint8Array;
  try {
    const aes = await vaultKey(prf, fromB64url(blob.salt));
    key = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: buf(fromB64url(blob.iv)), additionalData: aad(blob.address) },
        aes,
        buf(fromB64url(blob.ciphertext)),
      ),
    );
  } catch {
    throw new VaultLockedError();
  }
  let ok = false;
  try {
    ok = key.length === 32 && privateKeyToAddress(key) === blob.address;
  } catch {
    ok = false;
  }
  if (!ok) {
    wipe(key);
    throw new VaultLockedError();
  }
  return key;
}

// ── Passkeys ────────────────────────────────────────────────────────────────────────────────────────────────

interface PrfOutputs {
  enabled?: boolean;
  results?: { first?: BufferSource };
}

const prfOf = (cred: Credential | null): PrfOutputs | undefined =>
  (cred as PublicKeyCredential | null)?.getClientExtensionResults?.()
    ? ((cred as PublicKeyCredential).getClientExtensionResults() as { prf?: PrfOutputs }).prf
    : undefined;

/** Copies the PRF output out of the browser's buffer and zeroes the original. */
function takePrf(first: BufferSource | undefined): Uint8Array | null {
  if (!first) return null;
  const view = first instanceof ArrayBuffer ? new Uint8Array(first) : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
  if (view.length < 32) return null;
  const out = view.slice();
  wipe(view);
  return out;
}

const rawIdOf = (cred: Credential | null) => new Uint8Array((cred as PublicKeyCredential).rawId);

/** One user-verified assertion of this vault's passkey, with PRF(salt): the 32-byte secret (wipe it after use). */
export async function getPrfOutput(api: PasskeyApi, o: { rpId: string; credentialId: string; salt: Uint8Array }): Promise<Uint8Array> {
  const id = fromB64url(o.credentialId);
  const cred = await api.get({
    publicKey: {
      challenge: random(32), // nothing is verified server side: the PRF output itself is the proof
      rpId: o.rpId,
      allowCredentials: [{ type: "public-key", id: buf(id) }],
      userVerification: "required",
      timeout: 120_000,
      extensions: { prf: { eval: { first: buf(o.salt) } } } as AuthenticationExtensionsClientInputs,
    },
  });
  if (!cred) throw new VaultLockedError();
  if (b64url(rawIdOf(cred)) !== o.credentialId) throw new VaultLockedError();
  const prf = takePrf(prfOf(cred)?.results?.first);
  if (!prf) throw new PrfUnsupportedError();
  return prf;
}

export interface VaultUser {
  /** The VVake account id (never put in the passkey: the user handle is random). */
  id: string;
  /** What the passkey manager shows, e.g. the account's e-mail. */
  name: string;
  displayName: string;
}

/**
 * A new passkey for vvake.com with PRF, then its PRF(salt). Throws PrfUnsupportedError when the browser or the
 * authenticator has no PRF. The user handle is random, so a later wallet never replaces this passkey.
 */
export async function createPasskeyWithPrf(
  api: PasskeyApi,
  o: { rpId: string; user: VaultUser; salt: Uint8Array },
): Promise<{ credentialId: string; prf: Uint8Array }> {
  const cred = await api.create({
    publicKey: {
      rp: { id: o.rpId, name: "VVake" },
      user: { id: random(16), name: o.user.name, displayName: o.user.displayName },
      challenge: random(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none",
      timeout: 120_000,
      extensions: { prf: { eval: { first: buf(o.salt) } } } as AuthenticationExtensionsClientInputs,
    },
  });
  if (!cred) throw new PrfUnsupportedError();
  const credentialId = b64url(rawIdOf(cred));
  const ext = prfOf(cred);
  const now = takePrf(ext?.results?.first);
  if (now) return { credentialId, prf: now };
  // Some authenticators only say PRF is enabled at creation: one assertion gives the output.
  if (!ext?.enabled) throw new PrfUnsupportedError();
  return { credentialId, prf: await getPrfOutput(api, { rpId: o.rpId, credentialId, salt: o.salt }) };
}

/**
 * Creates the wallet: passkey + PRF first (nothing is generated if that fails), then the key, sealed at once; the
 * key and the PRF output are zeroed before this returns. The blob is what the page uploads.
 */
export async function createVault(
  api: PasskeyApi,
  o: { rpId: string; user: VaultUser; onKeyGenerated?: (key: Uint8Array) => void },
): Promise<{ blob: VaultBlob }> {
  const salt = random(32);
  const { credentialId, prf } = await createPasskeyWithPrf(api, { rpId: o.rpId, user: o.user, salt });
  const key = generatePrivateKey();
  try {
    o.onKeyGenerated?.(key);
    return { blob: await sealPrivateKey({ key, prf, salt, credentialId }) };
  } finally {
    wipe(key, prf);
  }
}

/** Opens the vault with a fresh passkey assertion, runs `fn` with the key, and zeroes the key and the PRF output. */
export async function withPrivateKey<T>(
  api: PasskeyApi,
  rpId: string,
  blob: VaultBlob,
  fn: (key: Uint8Array) => T | Promise<T>,
): Promise<T> {
  let prf: Uint8Array | null = null;
  let key: Uint8Array | null = null;
  try {
    prf = await getPrfOutput(api, { rpId, credentialId: blob.credentialId, salt: fromB64url(blob.salt) });
    key = await openPrivateKey(blob, prf);
    return await fn(key);
  } finally {
    wipe(prf, key);
  }
}

/**
 * The private key as hex, for the export screen only: refused until the 10 s warning has been up, and always behind
 * a new user-verified passkey assertion (never a key kept from an earlier step).
 */
export async function exportPrivateKey(
  api: PasskeyApi,
  rpId: string,
  blob: VaultBlob,
  o: { warningShownAt: number | null; now: number },
): Promise<string> {
  if (o.warningShownAt === null || o.now - o.warningShownAt < EXPORT_WARNING_MS) throw new ExportTooSoonError();
  return withPrivateKey(api, rpId, blob, (key) => bytesToHex(key));
}
