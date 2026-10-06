import { addressWord, readWord, word } from "./eth";
import { ClaimRefusedError, isSafeClaimTx, planClaims, type ClaimProofInput, type ClaimTx } from "./claimTx";
import { linkMessageProblems, readLinkMessage, type LinkProblem } from "./linkMessage";
import { rewardsConfig } from "./rewards-config";
import { isValidAddress, personalSign, recoverPersonalSigner, signEip1559, toChecksumAddress, txHash, type Eip1559Tx } from "./walletKeys";
import { withPrivateKey, type PasskeyApi, type VaultBlob } from "./walletVault";

/**
 * What the passkey wallet does with its key, and the checks in front of each use. Same rules as a browser wallet
 * on this page, with no wallet UI in between, so the checks are stricter:
 *
 * - Link: the server's message goes through linkMessage.ts (this wallet, this chain, this site) before the passkey
 *   is even asked; the signature is checked to recover to the vault address.
 * - Claim: only transactions from claimTx.ts (pinned rewards contract, claim/claimMany, 0 ETH), re-checked with
 *   isSafeClaimTx right before signing.
 * - Move prizes out: only `transfer(to, amount)` on the pinned VVAKE token, 0 ETH, to a checksummed address that
 *   isn't a contract of ours, the zero address or the wallet itself.
 *
 * The page sends the signed transaction to the public RPC itself (eth_sendRawTransaction). No relayer: the wallet
 * pays its own (testnet) gas, and a missing balance stops everything before the passkey is asked (NeedsGasError).
 */

export interface ChainRpc {
  rpc<T>(method: string, params: unknown[]): Promise<T>;
}

export interface VaultSigner {
  api: PasskeyApi;
  rpId: string;
  blob: VaultBlob;
}

export interface TxCall {
  to: string;
  data: string;
  value: "0x0";
}

export class LinkRefusedError extends Error {
  constructor(readonly problems: LinkProblem[]) {
    super(`link message refused: ${problems.join(", ")}`);
    this.name = "LinkRefusedError";
  }
}

/** The wallet has too little testnet ETH for this transaction's gas. */
export class NeedsGasError extends Error {
  constructor(
    readonly address: string,
    readonly needed: bigint,
    readonly balance: bigint,
  ) {
    super("needs gas");
    this.name = "NeedsGasError";
  }
}

export class TransferRefusedError extends Error {
  constructor() {
    super("transfer refused");
    this.name = "TransferRefusedError";
  }
}

// ── Link ────────────────────────────────────────────────────────────────────────────────────────────────────

/** personal_sign of the server's link message, only if it names this wallet, the rewards chain and this site. */
export async function signLinkWithVault(signer: VaultSigner, message: string, host: string): Promise<string> {
  const problems = linkMessageProblems(readLinkMessage(message), { account: signer.blob.address, chainId: rewardsConfig.chain.id, host });
  if (problems.length) throw new LinkRefusedError(problems);
  const signature = await withPrivateKey(signer.api, signer.rpId, signer.blob, (key) => personalSign(message, key));
  if (recoverPersonalSigner(message, signature) !== signer.blob.address) throw new LinkRefusedError(["wallet"]);
  return signature;
}

// ── Transactions ────────────────────────────────────────────────────────────────────────────────────────────

/** Nonce (pending), gas (estimate + 20%), fees (max = 2 × base fee + tip), and the balance check. */
export async function prepareTx(chain: ChainRpc, from: string, call: TxCall): Promise<Eip1559Tx> {
  const [nonce, estimate, tip, block, balance] = await Promise.all([
    chain.rpc<string>("eth_getTransactionCount", [from, "pending"]),
    chain.rpc<string>("eth_estimateGas", [{ from, to: call.to, data: call.data, value: call.value }]),
    chain.rpc<string>("eth_maxPriorityFeePerGas", []).catch(() => "0x0"),
    chain.rpc<{ baseFeePerGas?: string } | null>("eth_getBlockByNumber", ["latest", false]),
    chain.rpc<string>("eth_getBalance", [from, "latest"]),
  ]);
  const gas = (BigInt(estimate) * 12n) / 10n;
  const maxPriorityFeePerGas = BigInt(tip);
  const maxFeePerGas = 2n * BigInt(block?.baseFeePerGas ?? "0x0") + maxPriorityFeePerGas;
  const needed = gas * maxFeePerGas;
  if (BigInt(balance) < needed) throw new NeedsGasError(from, needed, BigInt(balance));
  return {
    chainId: rewardsConfig.chain.id,
    nonce: BigInt(nonce),
    maxPriorityFeePerGas,
    maxFeePerGas,
    gas,
    to: call.to,
    value: 0n,
    data: call.data,
  };
}

async function signAndSend(signer: VaultSigner, chain: ChainRpc, call: TxCall): Promise<string> {
  const tx = await prepareTx(chain, signer.blob.address, call);
  const raw = await withPrivateKey(signer.api, signer.rpId, signer.blob, (key) => signEip1559(tx, key));
  const local = txHash(raw);
  const sent = await chain.rpc<string>("eth_sendRawTransaction", [raw]);
  return typeof sent === "string" && /^0x[0-9a-fA-F]{64}$/.test(sent) ? sent : local;
}

/** The claim transactions for these proofs (claimTx.ts), or ClaimRefusedError: nothing is signed then. */
export function planVaultClaims(proofs: ClaimProofInput[]): ClaimTx[] {
  const plan = planClaims(proofs);
  if (!plan.ok) throw new ClaimRefusedError(plan.reason);
  return plan.txs;
}

/** Signs and sends one claim from the passkey wallet; the tx hash. Anything but a safe claim is refused first. */
export async function sendClaimWithVault(signer: VaultSigner, chain: ChainRpc, tx: ClaimTx): Promise<string> {
  if (!isSafeClaimTx(tx)) throw new ClaimRefusedError("badProof");
  return signAndSend(signer, chain, { to: tx.to, data: tx.data, value: "0x0" });
}

// ── Move prizes out (ERC-20 transfer of VVAKE) ──────────────────────────────────────────────────────────────

const TRANSFER = "0xa9059cbb"; // transfer(address,uint256)

export const transferCalldata = (to: string, amount: bigint) => TRANSFER + addressWord(to) + word(amount);

export type TransferRefusal = "address" | "checksum" | "zero" | "self" | "contract" | "amount";
export type TransferPlan = { ok: true; to: string; call: TxCall } | { ok: false; reason: TransferRefusal };

/** A VVAKE transfer from the passkey wallet to an address the person pasted, or why not. */
export function planTransfer(o: { to: string; amountBase: bigint; from: string }): TransferPlan {
  const to = o.to.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return { ok: false, reason: "address" };
  if (!isValidAddress(to)) return { ok: false, reason: "checksum" };
  if (/^0x0{40}$/.test(to)) return { ok: false, reason: "zero" };
  const lower = to.toLowerCase();
  if (lower === o.from.toLowerCase()) return { ok: false, reason: "self" };
  const ours = [rewardsConfig.token, rewardsConfig.rewardsContract, rewardsConfig.prizePool].filter(Boolean).map((a) => a.toLowerCase());
  if (ours.includes(lower)) return { ok: false, reason: "contract" };
  if (o.amountBase <= 0n || o.amountBase >= 1n << 256n) return { ok: false, reason: "amount" };
  const checksummed = toChecksumAddress(to);
  return { ok: true, to: checksummed, call: { to: rewardsConfig.token, data: transferCalldata(checksummed, o.amountBase), value: "0x0" } };
}

/** Only transfer(address,uint256) on the pinned token, a clean address word, 0 ETH. */
export function isSafeTransferTx(call: { to: string; data: string; value?: string }, token: string = rewardsConfig.token): boolean {
  return (
    /^0x[0-9a-fA-F]{40}$/.test(token) &&
    call.to.toLowerCase() === token.toLowerCase() &&
    new RegExp(`^${TRANSFER}0{24}[0-9a-f]{40}[0-9a-f]{64}$`).test(call.data) &&
    call.value === "0x0"
  );
}

export async function sendTransferWithVault(signer: VaultSigner, chain: ChainRpc, call: TxCall): Promise<string> {
  if (!isSafeTransferTx(call)) throw new TransferRefusedError();
  return signAndSend(signer, chain, call);
}

// ── Balances ────────────────────────────────────────────────────────────────────────────────────────────────

const BALANCE_OF = "0x70a08231"; // balanceOf(address)

/** Testnet ETH (for gas) and VVAKE held by the wallet, read from the public RPC. */
export async function walletBalances(chain: ChainRpc, address: string): Promise<{ eth: bigint; vvake: bigint }> {
  const [eth, vvake] = await Promise.all([
    chain.rpc<string>("eth_getBalance", [address, "latest"]),
    chain.rpc<string>("eth_call", [{ to: rewardsConfig.token, data: BALANCE_OF + addressWord(address) }, "latest"]),
  ]);
  return { eth: BigInt(eth), vvake: readWord(vvake) };
}

/** "12.5" → base units (18 decimals by default), or null when it isn't a plain positive decimal with ≤ `decimals` places. */
export function parseUnits(text: string, decimals = rewardsConfig.decimals): bigint | null {
  const t = text.trim().replace(",", ".");
  const m = /^(\d{1,40})(?:\.(\d+))?$/.exec(t);
  if (!m || (m[2] && m[2].length > decimals)) return null;
  return BigInt(m[1]!) * 10n ** BigInt(decimals) + BigInt((m[2] ?? "").padEnd(decimals, "0") || "0");
}
