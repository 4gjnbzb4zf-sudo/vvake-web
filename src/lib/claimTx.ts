import { claimCalldata, claimManyCalldata, SELECTOR } from "./eth";
import { ADDRESS, rewardsConfig } from "./rewards-config";

/**
 * Which claim transactions the rewards page sends, decided here and nowhere else (VV-06).
 *
 * The API only tells us *what* to claim (epoch, account, amount, Merkle proof). *How* is fixed by this page: the
 * transaction always goes to the rewards contract pinned in rewards-config.ts, its calldata is rebuilt here from those
 * four values (the API's `calldata` is ignored), its selector is claim or claimMany, and it sends 0 ETH. A
 * compromised or spoofed API can therefore at worst make a claim revert; it can never turn the claim button into an
 * `approve`, a transfer or a call to another contract. When the API names a different contract or chain, nothing is
 * sent at all.
 */

export interface ClaimProofInput {
  epoch: number;
  chainId: number;
  contract: string | null;
  account: string;
  amountBase: string;
  proof: string[];
  /** Sent by the API; never used. */
  calldata?: string;
}

export interface ClaimTx {
  to: string;
  data: string;
  value: "0x0";
  epochs: number[];
}

export type ClaimRefusal = "noContract" | "contractMismatch" | "chainMismatch" | "badProof";
export type ClaimPlan = { ok: true; txs: ClaimTx[] } | { ok: false; reason: ClaimRefusal };

/** Thrown by the page when a plan is refused, so the error message can say why nothing was sent. */
export class ClaimRefusedError extends Error {
  constructor(readonly reason: ClaimRefusal) {
    super(`claim refused: ${reason}`);
    this.name = "ClaimRefusedError";
  }
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const UINT = /^\d{1,78}$/;
const ALLOWED_SELECTORS: readonly string[] = [SELECTOR.claim, SELECTOR.claimMany];

const wellFormed = (p: ClaimProofInput) =>
  Number.isSafeInteger(p.epoch) &&
  p.epoch >= 0 &&
  ADDRESS.test(p.account) &&
  UINT.test(p.amountBase) &&
  BigInt(p.amountBase) < 1n << 256n &&
  Array.isArray(p.proof) &&
  p.proof.length <= 64 &&
  p.proof.every((h) => BYTES32.test(h));

/** The last check before a transaction reaches the wallet: pinned target, claim/claimMany selector, 0 ETH. */
export function isSafeClaimTx(tx: { to: string; data: string; value?: string }, pinned: string = rewardsConfig.rewardsContract): boolean {
  return (
    ADDRESS.test(pinned) &&
    tx.to.toLowerCase() === pinned.toLowerCase() &&
    ALLOWED_SELECTORS.includes(tx.data.slice(0, 10).toLowerCase()) &&
    /^0x[0-9a-f]*$/.test(tx.data) &&
    tx.value === "0x0"
  );
}

/**
 * The transactions for these proofs: one claim per account with one week, one claimMany per account with several.
 * `pinned` and `chainId` default to this build's rewards-config.ts (passed in only by tests).
 */
export function planClaims(
  proofs: ClaimProofInput[],
  pinned: string = rewardsConfig.rewardsContract,
  chainId: number = rewardsConfig.chain.id,
): ClaimPlan {
  if (!ADDRESS.test(pinned)) return { ok: false, reason: "noContract" };
  for (const p of proofs) {
    if (p.contract && p.contract.toLowerCase() !== pinned.toLowerCase()) return { ok: false, reason: "contractMismatch" };
    if (p.chainId !== chainId) return { ok: false, reason: "chainMismatch" };
    if (!wellFormed(p)) return { ok: false, reason: "badProof" };
  }
  const byAccount = new Map<string, ClaimProofInput[]>();
  for (const p of proofs) {
    const key = p.account.toLowerCase();
    byAccount.set(key, [...(byAccount.get(key) ?? []), p]);
  }
  const txs: ClaimTx[] = [];
  for (const group of byAccount.values()) {
    const account = group[0]!.account;
    const data =
      group.length === 1
        ? claimCalldata(group[0]!.epoch, account, BigInt(group[0]!.amountBase), group[0]!.proof)
        : claimManyCalldata(
            account,
            group.map((p) => ({ epoch: p.epoch, amount: BigInt(p.amountBase), proof: p.proof })),
          );
    const tx: ClaimTx = { to: pinned, data, value: "0x0", epochs: group.map((p) => p.epoch) };
    if (!isSafeClaimTx(tx, pinned)) return { ok: false, reason: "badProof" };
    txs.push(tx);
  }
  return { ok: true, txs };
}
