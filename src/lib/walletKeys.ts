import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/**
 * Keys and signatures of the passkey wallet (vvake.com/rewards), on two audited, pinned libraries only:
 * @noble/curves (secp256k1, RFC 6979 deterministic signatures, low-s) and @noble/hashes (keccak-256). The same two
 * the VVake API uses (services/api/src/rewards/eth.ts); nothing here is hand-rolled cryptography, only byte layout
 * (EIP-55, EIP-191, RLP, EIP-1559), checked byte for byte against Foundry's `cast` in walletKeys.test.ts.
 *
 * Private keys are Uint8Arrays so they can be wiped (wipe()) once used. A hex string of a key exists only on the
 * export screen, by design.
 */

// ── Bytes ───────────────────────────────────────────────────────────────────────────────────────────────────

const HEX = /^(0x)?([0-9a-fA-F]*)$/;

export function hexToBytes(h: string): Uint8Array {
  const m = HEX.exec(h);
  if (!m || m[2]!.length % 2) throw new TypeError("bad hex");
  const s = m[2]!;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export const bytesToHex = (b: Uint8Array) => "0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Overwrites secrets with zeros in place (keys, PRF outputs, derived bytes). Null / undefined are skipped. */
export function wipe(...items: (Uint8Array | ArrayBuffer | null | undefined)[]) {
  for (const it of items) {
    if (!it) continue;
    if (it instanceof Uint8Array) it.fill(0);
    else new Uint8Array(it).fill(0);
  }
}

// ── Keys and addresses ──────────────────────────────────────────────────────────────────────────────────────

/** A new secp256k1 private key: 32 bytes from the browser's CSPRNG (crypto.getRandomValues), a valid scalar. */
export function generatePrivateKey(): Uint8Array {
  return secp256k1.utils.randomSecretKey();
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** EIP-55 mixed-case checksum. */
export function toChecksumAddress(address: string): string {
  if (!ADDRESS.test(address)) throw new TypeError("not an address");
  const lower = address.slice(2).toLowerCase();
  const hash = bytesToHex(keccak_256(utf8(lower))).slice(2);
  let out = "0x";
  for (let i = 0; i < 40; i++) out += Number.parseInt(hash[i]!, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  return out;
}

/** Well formed, and when mixed case, carrying a valid EIP-55 checksum (catches typos); all lower / upper passes. */
export function isValidAddress(a: string): boolean {
  if (!ADDRESS.test(a)) return false;
  const body = a.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(a) === a;
}

const pubToAddress = (pub: Uint8Array) => toChecksumAddress(bytesToHex(keccak_256(pub.slice(1)).slice(12)));

/** The checksummed address of a private key. */
export const privateKeyToAddress = (key: Uint8Array) => pubToAddress(secp256k1.getPublicKey(key, false));

// ── EIP-191 personal_sign ───────────────────────────────────────────────────────────────────────────────────

function personalHash(message: string): Uint8Array {
  const m = utf8(message);
  return keccak_256(concat(utf8(`\x19Ethereum Signed Message:\n${m.length}`), m));
}

/** personal_sign of a UTF-8 message: r ‖ s ‖ v (27/28), what wallets return and the API's link route verifies. */
export function personalSign(message: string, key: Uint8Array): string {
  const s = secp256k1.sign(personalHash(message), key, { prehash: false, format: "recovered" });
  return bytesToHex(concat(s.slice(1), new Uint8Array([27 + s[0]!])));
}

/** The checksummed signer of a personal_sign signature, or null when it isn't a valid one. */
export function recoverPersonalSigner(message: string, signature: string): string | null {
  try {
    const sig = hexToBytes(signature);
    if (sig.length !== 65) return null;
    let v = sig[64]!;
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) return null;
    const pub = secp256k1.recoverPublicKey(concat(new Uint8Array([v]), sig.slice(0, 64)), personalHash(message), { prehash: false });
    return pubToAddress(secp256k1.Point.fromBytes(pub).toBytes(false));
  } catch {
    return null;
  }
}

// ── RLP + EIP-1559 ──────────────────────────────────────────────────────────────────────────────────────────

type Rlp = Uint8Array | Rlp[];

function minimalBytes(v: bigint): Uint8Array {
  if (v < 0n) throw new RangeError("negative");
  if (v === 0n) return new Uint8Array(0);
  let h = v.toString(16);
  if (h.length % 2) h = "0" + h;
  return hexToBytes(h);
}

function rlpLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([offset + len]);
  const l = minimalBytes(BigInt(len));
  return concat(new Uint8Array([offset + 55 + l.length]), l);
}

function rlpEncode(item: Rlp): Uint8Array {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0]! < 0x80) return item;
    return concat(rlpLength(item.length, 0x80), item);
  }
  const body = concat(...item.map(rlpEncode));
  return concat(rlpLength(body.length, 0xc0), body);
}

export interface Eip1559Tx {
  chainId: number;
  nonce: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gas: bigint;
  to: string;
  value: bigint;
  data: string;
}

/** A signed type-2 transaction (EIP-1559, chain id inside: replay protection), ready for eth_sendRawTransaction. */
export function signEip1559(tx: Eip1559Tx, key: Uint8Array): string {
  if (!ADDRESS.test(tx.to)) throw new TypeError("bad recipient");
  const fields: Rlp[] = [
    minimalBytes(BigInt(tx.chainId)),
    minimalBytes(tx.nonce),
    minimalBytes(tx.maxPriorityFeePerGas),
    minimalBytes(tx.maxFeePerGas),
    minimalBytes(tx.gas),
    hexToBytes(tx.to),
    minimalBytes(tx.value),
    hexToBytes(tx.data),
    [], // access list
  ];
  const hash = keccak_256(concat(new Uint8Array([2]), rlpEncode(fields)));
  const s = secp256k1.sign(hash, key, { prehash: false, format: "recovered" });
  const signed = [
    ...fields,
    minimalBytes(BigInt(s[0]!)),
    minimalBytes(BigInt(bytesToHex(s.slice(1, 33)))),
    minimalBytes(BigInt(bytesToHex(s.slice(33, 65)))),
  ];
  return bytesToHex(concat(new Uint8Array([2]), rlpEncode(signed)));
}

/** The hash of a raw transaction (what eth_sendRawTransaction answers and the explorer shows). */
export const txHash = (raw: string) => bytesToHex(keccak_256(hexToBytes(raw)));
