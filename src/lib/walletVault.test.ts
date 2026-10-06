import { describe, expect, it, vi } from "vitest";
import { personalSign, privateKeyToAddress, recoverPersonalSigner } from "./walletKeys";
import {
  createVault,
  EXPORT_WARNING_MS,
  ExportTooSoonError,
  exportPrivateKey,
  fromB64url,
  openPrivateKey,
  passkeyRpId,
  PrfUnsupportedError,
  sealPrivateKey,
  VAULT_FIELDS,
  VaultLockedError,
  withPrivateKey,
  type PasskeyApi,
  type VaultBlob,
} from "./walletVault";

const RP = "vvake.com";
const USER = { id: "user-123", name: "me@example.com", displayName: "VVake" };
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const CRED = Buffer.from(rand(16)).toString("base64url"); // a 16-byte credential id, the WebAuthn minimum

/**
 * A software stand-in for a platform passkey with the WebAuthn PRF extension: PRF(salt) = HMAC-SHA256(secret,
 * "WebAuthn PRF" ‖ 0 ‖ salt), as CTAP2 hmac-secret does under the hood. Records every create/get call.
 */
function fakePasskey(opts: { prf?: boolean; prfOnCreate?: boolean; secret?: Uint8Array } = {}) {
  const { prf = true, prfOnCreate = true } = opts;
  const secret = opts.secret ?? rand(32);
  const rawId = rand(16);
  const calls = { create: [] as CredentialCreationOptions[], get: [] as CredentialRequestOptions[] };
  const outputs: Uint8Array[] = [];
  async function evalPrf(salt: BufferSource): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey("raw", new Uint8Array(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const s = salt instanceof ArrayBuffer ? new Uint8Array(salt) : new Uint8Array(salt.buffer, salt.byteOffset, salt.byteLength);
    const label = new TextEncoder().encode("WebAuthn PRF\0");
    const input = new Uint8Array(label.length + s.length);
    input.set(label);
    input.set(s, label.length);
    const out = await crypto.subtle.sign("HMAC", k, input);
    outputs.push(new Uint8Array(out)); // a live view: the test can see it zeroed later
    return out;
  }
  const api: PasskeyApi = {
    async create(o?: CredentialCreationOptions) {
      calls.create.push(o!);
      const first = (o!.publicKey!.extensions as { prf?: { eval?: { first: BufferSource } } }).prf?.eval?.first;
      const ext = prf ? { prf: { enabled: true, ...(prfOnCreate && first ? { results: { first: await evalPrf(first) } } : {}) } } : {};
      return { type: "public-key", rawId: rawId.slice().buffer, getClientExtensionResults: () => ext } as unknown as Credential;
    },
    async get(o?: CredentialRequestOptions) {
      calls.get.push(o!);
      const first = (o!.publicKey!.extensions as { prf?: { eval?: { first: BufferSource } } }).prf?.eval?.first;
      const ext = prf && first ? { prf: { results: { first: await evalPrf(first) } } } : {};
      return { type: "public-key", rawId: rawId.slice().buffer, getClientExtensionResults: () => ext } as unknown as Credential;
    },
  };
  return { api, calls, outputs, secret };
}

describe("SEC-W17 passkey creation asks for exactly what the design says", () => {
  it("SEC-W17 rp.id vvake.com, resident key + user verification required, PRF eval with the vault salt", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    const pub = pk.calls.create[0]!.publicKey!;
    expect(pub.rp.id).toBe("vvake.com");
    expect(pub.authenticatorSelection?.residentKey).toBe("required");
    expect(pub.authenticatorSelection?.requireResidentKey).toBe(true);
    expect(pub.authenticatorSelection?.userVerification).toBe("required");
    const first = (pub.extensions as { prf: { eval: { first: Uint8Array } } }).prf.eval.first;
    expect([...new Uint8Array(first)]).toEqual([...fromB64url(blob.salt)]);
    expect(pub.pubKeyCredParams.map((p) => p.alg)).toEqual(expect.arrayContaining([-7, -257]));
  });

  it("SEC-W22 rp.id is vvake.com on vvake.com and its subdomains, localhost in development, nothing elsewhere", () => {
    expect(passkeyRpId("vvake.com")).toBe("vvake.com");
    expect(passkeyRpId("www.vvake.com")).toBe("vvake.com");
    expect(passkeyRpId("localhost")).toBe("localhost");
    expect(passkeyRpId("vvake.com.evil.app")).toBeNull();
    expect(passkeyRpId("evilvvake.com")).toBeNull();
    expect(passkeyRpId("vvake.github.io")).toBeNull();
  });
});

describe("SEC-W16 no PRF, no wallet (no weaker fallback)", () => {
  it("SEC-W16 an authenticator without PRF stops creation before any key exists or anything is uploaded", async () => {
    const pk = fakePasskey({ prf: false });
    const gen = vi.fn();
    await expect(createVault(pk.api, { rpId: RP, user: USER, onKeyGenerated: gen })).rejects.toBeInstanceOf(PrfUnsupportedError);
    expect(gen).not.toHaveBeenCalled();
  });

  it("SEC-W16 PRF enabled at creation but without results there: one assertion gets the output", async () => {
    const pk = fakePasskey({ prfOnCreate: false });
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    expect(pk.calls.get).toHaveLength(1);
    expect(blob.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe("SEC-W10 round trip: create → encrypt → decrypt → sign", () => {
  it("SEC-W10 the key opened with the passkey signs for the address stored in the blob", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    const sig = await withPrivateKey(pk.api, RP, blob, (key) => {
      expect(privateKeyToAddress(key)).toBe(blob.address);
      return personalSign("link me", key);
    });
    expect(recoverPersonalSigner("link me", sig)).toBe(blob.address);
    // The assertion was for this credential only, with user verification.
    const get = pk.calls.get.at(-1)!.publicKey!;
    expect(get.rpId).toBe(RP);
    expect(get.userVerification).toBe("required");
    expect(get.allowCredentials?.map((c) => [...new Uint8Array(c.id as ArrayBuffer)])).toEqual([[...fromB64url(blob.credentialId)]]);
  });
});

describe("SEC-W11 a stolen blob without the passkey can't be opened", () => {
  async function sealed() {
    const key = rand(32);
    key[0] = 1; // keep it a valid scalar
    const prf = rand(32);
    const salt = rand(32);
    const blob = await sealPrivateKey({ key: key.slice(), prf: prf.slice(), salt, credentialId: CRED });
    return { key, prf, blob };
  }

  it("SEC-W11 the right PRF output opens it", async () => {
    const { key, prf, blob } = await sealed();
    expect([...(await openPrivateKey(blob, prf.slice()))]).toEqual([...key]);
  });

  it("SEC-W11 another PRF output (another passkey, a guess) fails the AES-GCM tag check", async () => {
    const { blob } = await sealed();
    await expect(openPrivateKey(blob, rand(32))).rejects.toBeInstanceOf(VaultLockedError);
    await expect(openPrivateKey(blob, new Uint8Array(32))).rejects.toBeInstanceOf(VaultLockedError);
  });

  it("SEC-W11 a flipped ciphertext bit, another IV, salt or address all fail", async () => {
    const { prf, blob } = await sealed();
    const ct = fromB64url(blob.ciphertext);
    ct[0]! ^= 1;
    const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");
    const variants: VaultBlob[] = [
      { ...blob, ciphertext: b64(ct) },
      { ...blob, iv: b64(rand(12)) },
      { ...blob, salt: b64(rand(32)) },
      { ...blob, address: "0x000000000000000000000000000000000000dEaD" }, // the address is bound as AES-GCM AAD
    ];
    for (const v of variants) await expect(openPrivateKey(v, prf.slice())).rejects.toBeInstanceOf(VaultLockedError);
  });

  it("SEC-W11 a passkey with a different secret (same credential id) can't open the vault", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    const thief = fakePasskey(); // other secret
    await expect(withPrivateKey(thief.api, RP, blob, () => "never")).rejects.toBeInstanceOf(VaultLockedError);
  });
});

describe("SEC-W12 every encryption is different (random IV and salt)", () => {
  it("SEC-W12 the same key sealed twice gives different IVs and ciphertexts", async () => {
    const key = rand(32);
    key[0] = 1;
    const prf = rand(32);
    const salt = rand(32);
    const a = await sealPrivateKey({ key: key.slice(), prf: prf.slice(), salt, credentialId: CRED });
    const b = await sealPrivateKey({ key: key.slice(), prf: prf.slice(), salt, credentialId: CRED });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(fromB64url(a.iv)).toHaveLength(12);
  });

  it("SEC-W12 two vaults never share a salt", async () => {
    const pk = fakePasskey();
    const a = await createVault(pk.api, { rpId: RP, user: USER });
    const b = await createVault(pk.api, { rpId: RP, user: USER });
    expect(a.blob.salt).not.toBe(b.blob.salt);
  });
});

describe("SEC-W13 only the encrypted blob leaves the browser", () => {
  it("SEC-W13 the upload holds exactly {version, credentialId, salt, iv, ciphertext, address}, nothing named like a key", async () => {
    const pk = fakePasskey();
    let generated: Uint8Array | null = null;
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER, onKeyGenerated: (k) => (generated = k.slice()) });
    expect(Object.keys(blob).sort()).toEqual([...VAULT_FIELDS].sort());
    for (const k of Object.keys(blob)) expect(k).not.toMatch(/private|secret|prf|seed|mnemonic|^key$/i);
    const text = JSON.stringify(blob);
    const keyHex = Buffer.from(generated!).toString("hex");
    const keyB64 = Buffer.from(generated!).toString("base64url");
    expect(text).not.toContain(keyHex);
    expect(text).not.toContain(keyB64);
    for (const out of pk.outputs) expect(out.every((b) => b === 0)).toBe(true); // PRF outputs were wiped too
    expect(fromB64url(blob.ciphertext)).toHaveLength(32 + 16); // the key + the GCM tag, nothing more
  });
});

describe("SEC-W14 the key and the PRF output are zeroed after use", () => {
  it("SEC-W14 after a signature, and after a failure inside the callback", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    let seen: Uint8Array | null = null;
    await withPrivateKey(pk.api, RP, blob, (key) => {
      seen = key;
      return "ok";
    });
    expect(seen!.every((b) => b === 0)).toBe(true);
    await expect(
      withPrivateKey(pk.api, RP, blob, (key) => {
        seen = key;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(seen!.every((b) => b === 0)).toBe(true);
    for (const out of pk.outputs) expect(out.every((b) => b === 0)).toBe(true);
  });

  it("SEC-W14 the generated key is zeroed once sealed", async () => {
    const pk = fakePasskey();
    let live: Uint8Array | null = null;
    await createVault(pk.api, { rpId: RP, user: USER, onKeyGenerated: (k) => (live = k) });
    expect(live!.every((b) => b === 0)).toBe(true);
  });
});

describe("SEC-W15 export needs a fresh passkey assertion after the 10 s warning", () => {
  it("SEC-W15 before the warning has run 10 s: refused, the passkey isn't even asked", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    const before = pk.calls.get.length;
    await expect(exportPrivateKey(pk.api, RP, blob, { warningShownAt: 1_000, now: 1_000 + EXPORT_WARNING_MS - 1 })).rejects.toBeInstanceOf(
      ExportTooSoonError,
    );
    await expect(exportPrivateKey(pk.api, RP, blob, { warningShownAt: null, now: 50_000 })).rejects.toBeInstanceOf(ExportTooSoonError);
    expect(pk.calls.get.length).toBe(before);
    expect(EXPORT_WARNING_MS).toBe(10_000);
  });

  it("SEC-W15 every export asks the passkey again (user verification required, no silent mediation)", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    const before = pk.calls.get.length;
    const one = await exportPrivateKey(pk.api, RP, blob, { warningShownAt: 0, now: EXPORT_WARNING_MS });
    const two = await exportPrivateKey(pk.api, RP, blob, { warningShownAt: 0, now: EXPORT_WARNING_MS + 5 });
    expect(pk.calls.get.length).toBe(before + 2);
    for (const c of pk.calls.get.slice(before)) {
      expect(c.publicKey!.userVerification).toBe("required");
      expect(c.mediation === undefined || c.mediation === "required" || c.mediation === "optional").toBe(true);
    }
    expect(one).toMatch(/^0x[0-9a-f]{64}$/);
    expect(one).toBe(two);
    expect(privateKeyToAddress(Uint8Array.from(Buffer.from(one.slice(2), "hex")))).toBe(blob.address);
  });

  it("SEC-W15 a wrong passkey can't export", async () => {
    const pk = fakePasskey();
    const { blob } = await createVault(pk.api, { rpId: RP, user: USER });
    await expect(exportPrivateKey(fakePasskey().api, RP, blob, { warningShownAt: 0, now: EXPORT_WARNING_MS })).rejects.toBeInstanceOf(
      VaultLockedError,
    );
  });
});
