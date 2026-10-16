import { keccak_256 } from "@noble/hashes/sha3.js";
import { ethCall, type Eip1193 } from "./chain";
import { addressWord, readBool, readWord, word } from "./eth";
import { ADDRESS, ogClaimConfig } from "./rewards-config";

/**
 * The OG v1 holders claim (VVakeOGClaim, monorepo contracts/src/VVakeOGClaim.sol): the published list, its proofs
 * checked in the browser, and the one transaction the page may send.
 *
 * Like the weekly claim (src/lib/claimTx.ts), the target, selector and value are fixed here: the transaction always
 * goes to `ogClaimConfig.address`, calls claim(address,uint256,bytes32[]) and sends 0 ETH. The list is only data: a
 * list whose root isn't the pinned root, or an entry whose proof doesn't verify, is refused before the wallet is asked.
 */

export const OG_SELECTOR = {
  claim: "0x3d13f874", // claim(address,uint256,bytes32[])
  isClaimed: "0x8cc08025", // isClaimed(address)
  deadline: "0x29dcb0cf", // deadline()
  totalClaimed: "0xd54ad2a1", // totalClaimed()
} as const;

export interface OgEntry {
  amount: string;
  leaf: string;
  proof: string[];
}

export interface OgList {
  root: string;
  total: string;
  count: number;
  snapshotBlock: number;
  /** EIP-55 address → entry. */
  claims: Record<string, OgEntry>;
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const UINT = /^\d{1,78}$/;

const hexToBytes = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b: Uint8Array) => "0x" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

/** keccak256(bytes.concat(keccak256(abi.encode(account, amount)))): the OpenZeppelin standard leaf. */
export function ogLeaf(account: string, amount: bigint): string {
  const inner = keccak_256(hexToBytes(addressWord(account) + word(amount)));
  return bytesToHex(keccak_256(inner));
}

/** OpenZeppelin MerkleProof.verify: sorted-pair keccak up the tree. */
export function verifyOgProof(proof: string[], root: string, leaf: string): boolean {
  let node = leaf.toLowerCase();
  for (const sibling of proof) {
    const s = sibling.toLowerCase();
    const [a, b] = node < s ? [node, s] : [s, node];
    node = bytesToHex(keccak_256(hexToBytes(a.slice(2) + b.slice(2))));
  }
  return node === root.toLowerCase();
}

/** The list file as published, or null when it isn't shaped like one. */
export function parseOgList(json: unknown): OgList | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (typeof j.root !== "string" || !BYTES32.test(j.root) || typeof j.total !== "string" || !UINT.test(j.total)) return null;
  if (!j.claims || typeof j.claims !== "object") return null;
  const claims: Record<string, OgEntry> = {};
  for (const [address, raw] of Object.entries(j.claims as Record<string, unknown>)) {
    const e = raw as Partial<OgEntry> | null;
    if (!ADDRESS.test(address) || !e || typeof e.amount !== "string" || !UINT.test(e.amount)) return null;
    if (typeof e.leaf !== "string" || !BYTES32.test(e.leaf) || !Array.isArray(e.proof) || e.proof.length > 64) return null;
    if (!e.proof.every((h) => typeof h === "string" && BYTES32.test(h))) return null;
    claims[address] = { amount: e.amount, leaf: e.leaf, proof: e.proof };
  }
  return {
    root: j.root,
    total: j.total,
    count: typeof j.count === "number" ? j.count : Object.keys(claims).length,
    snapshotBlock: typeof j.snapshotBlock === "number" ? j.snapshotBlock : ogClaimConfig.snapshotBlock,
    claims,
  };
}

/** Whether the list is the one the contract is deployed with: pinned root and total, every proof verifies, Σ == total. */
export function isPinnedList(list: OgList, root = ogClaimConfig.root, total = ogClaimConfig.total): boolean {
  if (list.root.toLowerCase() !== root.toLowerCase() || list.total !== total) return false;
  let sum = 0n;
  for (const [address, e] of Object.entries(list.claims)) {
    const leaf = ogLeaf(address, BigInt(e.amount));
    if (leaf !== e.leaf.toLowerCase() || !verifyOgProof(e.proof, root, leaf)) return false;
    sum += BigInt(e.amount);
  }
  return sum === BigInt(total);
}

/** The entry of `address` (any letter case), with its EIP-55 key, or null when the address isn't on the list. */
export function findOgEntry(list: OgList, address: string): { address: string; entry: OgEntry } | null {
  const lower = address.toLowerCase();
  for (const [a, entry] of Object.entries(list.claims)) if (a.toLowerCase() === lower) return { address: a, entry };
  return null;
}

/** The list as rows, largest amount first (ties by address). */
export function ogRows(list: OgList): { address: string; amount: bigint }[] {
  return Object.entries(list.claims)
    .map(([address, e]) => ({ address, amount: BigInt(e.amount) }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
}

export const ogClaimCalldata = (account: string, amount: bigint, proof: string[]) =>
  OG_SELECTOR.claim +
  addressWord(account) +
  word(amount) +
  word(0x60) +
  word(proof.length) +
  proof
    .map((h) => {
      if (!BYTES32.test(h)) throw new TypeError("not a bytes32");
      return h.slice(2).toLowerCase();
    })
    .join("");

export interface OgClaimTx {
  to: string;
  data: string;
  value: "0x0";
}

/** The last check before the wallet is asked: pinned contract, claim selector, 0 ETH. */
export function isSafeOgClaimTx(tx: { to: string; data: string; value?: string }, pinned: string | null = ogClaimConfig.address): boolean {
  return (
    pinned !== null &&
    ADDRESS.test(pinned) &&
    tx.to.toLowerCase() === pinned.toLowerCase() &&
    tx.data.slice(0, 10).toLowerCase() === OG_SELECTOR.claim &&
    /^0x[0-9a-f]*$/.test(tx.data) &&
    tx.value === "0x0"
  );
}

export type OgRefusal = "notDeployed" | "notListed" | "badList";

/** The claim transaction for `account`, or why there is none. Checks the entry's proof against the pinned root. */
export function planOgClaim(
  list: OgList,
  account: string,
  pinned: string | null = ogClaimConfig.address,
  root: string = ogClaimConfig.root,
): { ok: true; tx: OgClaimTx; amount: bigint } | { ok: false; reason: OgRefusal } {
  if (!pinned || !ADDRESS.test(pinned)) return { ok: false, reason: "notDeployed" };
  const found = findOgEntry(list, account);
  if (!found) return { ok: false, reason: "notListed" };
  const amount = BigInt(found.entry.amount);
  if (!verifyOgProof(found.entry.proof, root, ogLeaf(found.address, amount))) return { ok: false, reason: "badList" };
  const tx: OgClaimTx = { to: pinned, data: ogClaimCalldata(found.address, amount, found.entry.proof), value: "0x0" };
  if (!isSafeOgClaimTx(tx, pinned)) return { ok: false, reason: "badList" };
  return { ok: true, tx, amount };
}

/** What the contract says: its deadline (unix seconds), Σ claimed, and whether `account` has claimed. */
export async function ogOnChain(
  contract: string,
  account: string | null,
): Promise<{ deadline: number; totalClaimed: bigint; claimed: boolean | null }> {
  const [deadline, totalClaimed, claimed] = await Promise.all([
    ethCall(contract, OG_SELECTOR.deadline),
    ethCall(contract, OG_SELECTOR.totalClaimed),
    account ? ethCall(contract, OG_SELECTOR.isClaimed + addressWord(account)) : Promise.resolve(null),
  ]);
  return {
    deadline: Number(readWord(deadline)),
    totalClaimed: readWord(totalClaimed),
    claimed: claimed === null ? null : readBool(claimed),
  };
}

/** Sends the claim from the visitor's wallet (only a transaction that passes isSafeOgClaimTx); the tx hash. */
export async function sendOgClaim(w: Eip1193, from: string, tx: OgClaimTx): Promise<string> {
  if (!isSafeOgClaimTx(tx)) throw new Error("og claim refused");
  return (await w.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: tx.value }] })) as string;
}
