import { describe, expect, it } from "vitest";
import { ClaimRefusedError, type ClaimProofInput } from "./claimTx";
import { claimCalldata, SELECTOR } from "./eth";
import {
  isSafeTransferTx,
  LinkRefusedError,
  NeedsGasError,
  planTransfer,
  planVaultClaims,
  prepareTx,
  sendClaimWithVault,
  sendTransferWithVault,
  signLinkWithVault,
  transferCalldata,
  type ChainRpc,
} from "./passkeyWallet";
import { rewardsConfig } from "./rewards-config";
import { bytesToHex, recoverPersonalSigner, signEip1559, txHash } from "./walletKeys";
import { createVault, withPrivateKey, type PasskeyApi } from "./walletVault";

const RP = "vvake.com";
const PINNED = rewardsConfig.rewardsContract;
const TOKEN = rewardsConfig.token;
const OUT = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const PROOF = ["0x" + "ab".repeat(32), "0x" + "cd".repeat(32)];

/** Minimal PRF passkey (see walletVault.test.ts for the annotated one); counts assertions. */
function passkey() {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const rawId = crypto.getRandomValues(new Uint8Array(16));
  const counts = { get: 0 };
  const prf = async (salt: BufferSource) => {
    const k = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return crypto.subtle.sign("HMAC", k, salt);
  };
  const first = (o: { publicKey?: { extensions?: unknown } }) =>
    (o.publicKey!.extensions as { prf: { eval: { first: BufferSource } } }).prf.eval.first;
  const api: PasskeyApi = {
    async create(o?: CredentialCreationOptions) {
      const ext = { prf: { enabled: true, results: { first: await prf(first(o!)) } } };
      return { rawId: rawId.slice().buffer, getClientExtensionResults: () => ext } as unknown as Credential;
    },
    async get(o?: CredentialRequestOptions) {
      counts.get++;
      const ext = { prf: { results: { first: await prf(first(o!)) } } };
      return { rawId: rawId.slice().buffer, getClientExtensionResults: () => ext } as unknown as Credential;
    },
  };
  return { api, counts };
}

async function vault() {
  const pk = passkey();
  const { blob } = await createVault(pk.api, { rpId: RP, user: { id: "u1", name: "me", displayName: "VVake" } });
  const signer = { api: pk.api, rpId: RP, blob };
  const key = await withPrivateKey(pk.api, RP, blob, (k) => k.slice()); // test-only copy, to recompute signatures
  pk.counts.get = 0;
  return { pk, signer, blob, key };
}

/** A fake public RPC: fixed nonce / fees / gas, a balance, and it records what was sent. */
function fakeChain(balanceWei = 10n ** 17n) {
  const sent: string[] = [];
  const calls: string[] = [];
  const chain: ChainRpc = {
    async rpc<T>(method: string, params: unknown[]): Promise<T> {
      calls.push(method);
      const r: Record<string, unknown> = {
        eth_getTransactionCount: "0x3",
        eth_estimateGas: "0x15f90", // 90,000
        eth_maxPriorityFeePerGas: "0xf4240", // 0.001 gwei
        eth_getBlockByNumber: { baseFeePerGas: "0x5f5e100" }, // 0.1 gwei
        eth_getBalance: "0x" + balanceWei.toString(16),
        eth_chainId: "0x" + rewardsConfig.chain.id.toString(16),
      };
      if (method === "eth_sendRawTransaction") {
        sent.push(params[0] as string);
        return txHash(params[0] as string) as T;
      }
      return r[method] as T;
    },
  };
  return { chain, sent, calls };
}

const linkMessage = (wallet: string, over: { chain?: number; domain?: string } = {}) =>
  [
    `${over.domain ?? "vvake.com"} wants you to sign in with your Ethereum account:`,
    wallet,
    "",
    "Link this wallet to your VVake account to receive $VVAKE prizes.",
    "",
    "URI: https://vvake.com/rewards",
    "Version: 1",
    `Chain ID: ${over.chain ?? rewardsConfig.chain.id}`,
    "Nonce: abc123",
    "Issued At: 2026-10-06T07:00:00.000Z",
    "Expiration Time: 2026-10-06T07:10:00.000Z",
  ].join("\n");

describe("SEC-W18 the passkey wallet links only through linkMessage.ts validation", () => {
  it("SEC-W18 a valid message for this wallet is signed and recovers to the vault address", async () => {
    const { signer, blob, pk } = await vault();
    const msg = linkMessage(blob.address);
    const sig = await signLinkWithVault(signer, msg, "vvake.com");
    expect(recoverPersonalSigner(msg, sig)).toBe(blob.address);
    expect(pk.counts.get).toBe(1);
  });

  it("SEC-W18 another wallet, chain or site: refused before the passkey is asked", async () => {
    const { signer, blob, pk } = await vault();
    const bad = [
      linkMessage("0x000000000000000000000000000000000000dEaD"),
      linkMessage(blob.address, { chain: 1 }),
      linkMessage(blob.address, { domain: "vvake-rewards.app" }),
      "Sign this",
    ];
    for (const m of bad) await expect(signLinkWithVault(signer, m, "vvake.com")).rejects.toBeInstanceOf(LinkRefusedError);
    expect(pk.counts.get).toBe(0);
  });
});

const proof = (over: Partial<ClaimProofInput> = {}): ClaimProofInput => ({
  epoch: 2909,
  chainId: rewardsConfig.chain.id,
  contract: PINNED,
  account: OUT,
  amountBase: "1000000000000000000",
  proof: PROOF,
  ...over,
});

describe("SEC-W19 passkey claims go through claimTx.ts (pinned contract, claim selector, 0 ETH)", () => {
  it("SEC-W19 a compromised API (another contract / chain) is refused before the passkey or the RPC", async () => {
    expect(() => planVaultClaims([proof({ contract: TOKEN })])).toThrow(ClaimRefusedError);
    expect(() => planVaultClaims([proof({ chainId: 1 })])).toThrow(ClaimRefusedError);
  });

  it("SEC-W19 a crafted tx (approve, other target, ETH value) never reaches the passkey or the RPC", async () => {
    const { signer, pk } = await vault();
    const { chain, calls } = fakeChain();
    const approve = "0x095ea7b3" + "00".repeat(12) + OUT.slice(2).toLowerCase() + "f".repeat(64);
    for (const tx of [
      { to: TOKEN, data: approve, value: "0x0" as const, epochs: [1] },
      { to: PINNED, data: approve, value: "0x0" as const, epochs: [1] },
      { to: PINNED, data: claimCalldata(1, OUT, 1n, PROOF), value: "0x1" as unknown as "0x0", epochs: [1] },
    ])
      await expect(sendClaimWithVault(signer, chain, tx)).rejects.toBeInstanceOf(ClaimRefusedError);
    expect(pk.counts.get).toBe(0);
    expect(calls).toEqual([]);
  });

  it("SEC-W19 the raw transaction sent is exactly the planned claim, EIP-1559 on chain 46630, signed by the vault", async () => {
    const { signer, key } = await vault();
    const { chain, sent } = fakeChain();
    const [tx] = planVaultClaims([proof()]);
    const hash = await sendClaimWithVault(signer, chain, tx!);
    expect(sent).toHaveLength(1);
    expect(hash).toBe(txHash(sent[0]!));
    const expected = signEip1559(
      {
        chainId: rewardsConfig.chain.id,
        nonce: 3n,
        maxPriorityFeePerGas: 1_000_000n,
        maxFeePerGas: 2n * 100_000_000n + 1_000_000n,
        gas: (90_000n * 12n) / 10n,
        to: PINNED,
        value: 0n,
        data: claimCalldata(2909, OUT, 10n ** 18n, PROOF),
      },
      key,
    );
    expect(sent[0]).toBe(expected);
    expect(sent[0]!.startsWith("0x02")).toBe(true);
  });

  it("SEC-W19 not enough testnet ETH for gas: nothing is signed or sent", async () => {
    const { signer, pk } = await vault();
    const { chain, sent } = fakeChain(0n);
    const [tx] = planVaultClaims([proof()]);
    await expect(sendClaimWithVault(signer, chain, tx!)).rejects.toBeInstanceOf(NeedsGasError);
    expect(pk.counts.get).toBe(0);
    expect(sent).toEqual([]);
  });
});

describe("SEC-W20 moving prizes out: one ERC-20 transfer of VVAKE to a checked address", () => {
  const FROM = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

  it("SEC-W20 transfer calldata matches cast calldata", () => {
    expect(transferCalldata(OUT, 10n ** 18n)).toBe(
      "0xa9059cbb0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba720000000000000000000000000000000000000000000000000de0b6b3a7640000",
    );
  });

  it("SEC-W20 refuses a bad checksum, the zero address, itself, the token / rewards / pool contracts, a zero amount", () => {
    const plan = (to: string, amountBase = 10n ** 18n) => planTransfer({ to, amountBase, from: FROM });
    expect(plan(OUT.replace("8ba1", "8bA1"))).toEqual({ ok: false, reason: "checksum" });
    expect(plan("0x1234")).toEqual({ ok: false, reason: "address" });
    expect(plan("0x0000000000000000000000000000000000000000")).toEqual({ ok: false, reason: "zero" });
    expect(plan(FROM)).toEqual({ ok: false, reason: "self" });
    expect(plan(FROM.toLowerCase())).toEqual({ ok: false, reason: "self" });
    for (const c of [TOKEN, PINNED, rewardsConfig.prizePool]) expect(plan(c)).toEqual({ ok: false, reason: "contract" });
    expect(plan(OUT, 0n)).toEqual({ ok: false, reason: "amount" });
    const ok = plan(OUT);
    expect(ok).toEqual({ ok: true, to: OUT, call: { to: TOKEN, data: transferCalldata(OUT, 10n ** 18n), value: "0x0" } });
  });

  it("SEC-W20 only transfer() on the pinned token with 0 ETH is ever signed", async () => {
    expect(isSafeTransferTx({ to: TOKEN, data: transferCalldata(OUT, 1n), value: "0x0" })).toBe(true);
    expect(isSafeTransferTx({ to: PINNED, data: transferCalldata(OUT, 1n), value: "0x0" })).toBe(false);
    expect(isSafeTransferTx({ to: TOKEN, data: "0x095ea7b3" + transferCalldata(OUT, 1n).slice(10), value: "0x0" })).toBe(false);
    expect(isSafeTransferTx({ to: TOKEN, data: transferCalldata(OUT, 1n) + "00", value: "0x0" })).toBe(false);
    expect(isSafeTransferTx({ to: TOKEN, data: transferCalldata(OUT, 1n), value: "0x1" })).toBe(false);
    const { signer, pk } = await vault();
    const { chain, calls } = fakeChain();
    await expect(sendTransferWithVault(signer, chain, { to: PINNED, data: transferCalldata(OUT, 1n), value: "0x0" })).rejects.toThrow();
    expect(pk.counts.get).toBe(0);
    expect(calls).toEqual([]);
  });

  it("SEC-W20 a planned transfer is signed by the vault and sent as is", async () => {
    const { signer, blob } = await vault();
    const { chain, sent } = fakeChain();
    const plan = planTransfer({ to: OUT, amountBase: 5n, from: blob.address });
    if (!plan.ok) throw new Error("plan refused");
    await sendTransferWithVault(signer, chain, plan.call);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(TOKEN.slice(2).toLowerCase());
    expect(sent[0]).toContain(transferCalldata(OUT, 5n).slice(2));
  });
});

describe("gas and fees for the passkey wallet", () => {
  it("prepares an EIP-1559 tx: pending nonce, estimate + 20%, max fee = 2 × base fee + tip", async () => {
    const { chain } = fakeChain();
    const tx = await prepareTx(chain, OUT, { to: PINNED, data: SELECTOR.claim, value: "0x0" });
    expect(tx).toMatchObject({
      chainId: 46630,
      nonce: 3n,
      gas: 108_000n,
      maxPriorityFeePerGas: 1_000_000n,
      maxFeePerGas: 201_000_000n,
      value: 0n,
    });
  });

  it("needs gas: the error carries the address to fund and what is missing", async () => {
    const { chain } = fakeChain(1n);
    const e = await prepareTx(chain, OUT, { to: PINNED, data: SELECTOR.claim, value: "0x0" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NeedsGasError);
    expect((e as NeedsGasError).address).toBe(OUT);
    expect((e as NeedsGasError).needed).toBe(108_000n * 201_000_000n);
    expect(bytesToHex(new Uint8Array([1]))).toBe("0x01");
  });
});

describe("amounts typed on the move screen", () => {
  it("parses plain decimals into base units, refuses the rest", async () => {
    const { parseUnits } = await import("./passkeyWallet");
    expect(parseUnits("1")).toBe(10n ** 18n);
    expect(parseUnits("0,5")).toBe(5n * 10n ** 17n);
    expect(parseUnits("12.000000000000000001")).toBe(12n * 10n ** 18n + 1n);
    expect(parseUnits("1.0000000000000000001")).toBeNull();
    for (const bad of ["", "-1", "1e18", "0x10", "1.2.3", " . "]) expect(parseUnits(bad)).toBeNull();
  });
});
