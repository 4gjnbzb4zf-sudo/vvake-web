import { decodePoolLog, isClaimedCalldata, readBool, readWord, SELECTOR, TOPIC, type PoolEvent, type RpcLog } from "./eth";
import { rewardsConfig } from "./rewards-config";

/**
 * Reading the chain from the browser (the public RPC answers CORS for any origin) and talking to the visitor's own
 * injected wallet (EIP-1193: MetaMask, Rabby, Coinbase Wallet…). Read-only calls never touch the wallet. The site
 * never sees a private key or a recovery phrase: the wallet signs, the site only gets the signature or the tx hash.
 */

const chain = rewardsConfig.chain;

export class RpcError extends Error {}

let rpcId = 0;
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let res: Response;
  try {
    res = await fetch(chain.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
  } catch {
    throw new RpcError(`${method}: network`);
  }
  const json = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!res.ok || !json || json.error || json.result === undefined) throw new RpcError(`${method}: ${json?.error?.message ?? res.status}`);
  return json.result;
}

export const ethCall = (to: string, data: string) => rpc<string>("eth_call", [{ to, data }, "latest"]);

/** Whether `account` already claimed `epoch` on VVakeRewards (null when the chain can't be read). */
export async function isClaimedOnChain(contract: string, epoch: number, account: string): Promise<boolean | null> {
  try {
    return readBool(await ethCall(contract, isClaimedCalldata(epoch, account)));
  } catch {
    return null;
  }
}

// ── The prize pool ──────────────────────────────────────────────────────────────────────────────────────────

export interface PoolTotals {
  funded: bigint;
  spent: bigint;
  bought: bigint;
  buyCount: bigint;
  balance: bigint;
  /** Unix seconds; 0 = a buy is allowed now (before the first buy too). */
  nextBuyAt: number;
  nextBuyAmount: bigint;
  paused: boolean;
}

export async function poolTotals(pool: string): Promise<PoolTotals> {
  const read = (sel: string) => ethCall(pool, sel);
  const [funded, spent, bought, buyCount, nextBuyAt, nextBuyAmount, paused, balance] = await Promise.all([
    read(SELECTOR.totalFunded),
    read(SELECTOR.totalSpent),
    read(SELECTOR.totalBought),
    read(SELECTOR.buyCount),
    read(SELECTOR.nextBuyAt),
    read(SELECTOR.nextBuyAmount),
    read(SELECTOR.paused),
    rpc<string>("eth_getBalance", [pool, "latest"]),
  ]);
  return {
    funded: readWord(funded),
    spent: readWord(spent),
    bought: readWord(bought),
    buyCount: readWord(buyCount),
    balance: BigInt(balance),
    nextBuyAt: Number(readWord(nextBuyAt)),
    nextBuyAmount: readWord(nextBuyAmount),
    paused: readBool(paused),
  };
}

export type DatedPoolEvent = PoolEvent & { time: number | null };

/**
 * The latest Funded / Bought events, newest first: eth_getLogs backwards from the head in `logSpan` windows (the
 * API's VVAKE_LOG_SPAN), down to the deploy block, at most `maxLogWindows` calls, until `limit` events are found.
 */
export async function recentPoolEvents(
  pool: string,
  fromBlock: number,
  limit = 10,
): Promise<{ events: DatedPoolEvent[]; complete: boolean }> {
  const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const found: PoolEvent[] = [];
  let to = head;
  let windows = 0;
  while (to >= fromBlock && found.length < limit && windows < rewardsConfig.maxLogWindows) {
    const from = Math.max(fromBlock, to - rewardsConfig.logSpan + 1);
    const logs = await rpc<RpcLog[]>("eth_getLogs", [
      { address: pool, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16), topics: [[TOPIC.funded, TOPIC.bought]] },
    ]);
    for (const log of logs) {
      const e = decodePoolLog(log);
      if (e) found.push(e);
    }
    to = from - 1;
    windows++;
  }
  found.sort((a, b) => b.block - a.block || b.index - a.index);
  const events = found.slice(0, limit);
  // One block read per distinct block shown, for the date (a failed read just leaves the date out).
  const blocks = [...new Set(events.map((e) => e.block))];
  const times = new Map<number, number>();
  await Promise.all(
    blocks.map(async (b) => {
      try {
        const block = await rpc<{ timestamp: string } | null>("eth_getBlockByNumber", ["0x" + b.toString(16), false]);
        if (block) times.set(b, Number(BigInt(block.timestamp)));
      } catch {
        // no date
      }
    }),
  );
  return { events: events.map((e) => ({ ...e, time: times.get(e.block) ?? null })), complete: to < fromBlock };
}

// ── The visitor's wallet (EIP-1193) ─────────────────────────────────────────────────────────────────────────

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export const injectedWallet = (): Eip1193 | null =>
  typeof window !== "undefined" ? ((window as unknown as { ethereum?: Eip1193 }).ethereum ?? null) : null;

/** The wallet's error code (4001 = the person said no, 4902 = unknown chain), when it has one. */
export const walletErrorCode = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number((e as { code: unknown }).code) : null);

export async function connectWallet(w: Eip1193): Promise<string | null> {
  const accounts = (await w.request({ method: "eth_requestAccounts" })) as string[];
  return accounts[0] ?? null;
}

export async function walletChainId(w: Eip1193): Promise<number> {
  return Number(BigInt((await w.request({ method: "eth_chainId" })) as string));
}

/** Switches the wallet to Robinhood Chain Testnet, adding the network first when the wallet doesn't know it. */
export async function switchToRewardsChain(w: Eip1193) {
  try {
    await w.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.idHex }] });
  } catch (e) {
    if (walletErrorCode(e) !== 4902) throw e;
    await w.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chain.idHex,
          chainName: chain.name,
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.explorerUrl],
          nativeCurrency: chain.nativeCurrency,
        },
      ],
    });
  }
}

/** personal_sign of a UTF-8 message (hex-encoded) by `address`: the 65-byte signature. */
export async function signMessage(w: Eip1193, address: string, messageHex: string): Promise<string> {
  return (await w.request({ method: "personal_sign", params: [messageHex, address] })) as string;
}

/** Sends a transaction from the visitor's wallet (the wallet shows it and asks); the tx hash. */
export async function sendTransaction(w: Eip1193, from: string, to: string, data: string): Promise<string> {
  return (await w.request({ method: "eth_sendTransaction", params: [{ from, to, data }] })) as string;
}

/** Waits for a transaction's receipt on the public RPC: true = success, false = reverted, null = not seen in time. */
export async function waitForReceipt(hash: string, timeoutMs = 120_000): Promise<boolean | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await rpc<{ status: string } | null>("eth_getTransactionReceipt", [hash]);
      if (r) return BigInt(r.status) === 1n;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return null;
}
