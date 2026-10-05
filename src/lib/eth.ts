/**
 * The little Ethereum the rewards page needs, by hand (no viem/ethers): ABI encoding for the few calls it makes,
 * decoding of uint/bool words and of the prize pool's two events, and token amounts as text.
 *
 * Selectors and event topics are fixed by the contracts (monorepo `contracts/src`); computed once with
 * `cast sig` / `cast sig-event` and checked against `cast calldata` output in eth.test.ts.
 */

export const SELECTOR = {
  // VVakeRewards
  claim: "0x2e7ba6ef", // claim(uint256,address,uint256,bytes32[])
  claimMany: "0xfae68828", // claimMany(uint256[],address,uint256[],bytes32[][])
  isClaimed: "0xd2ef0795", // isClaimed(uint256,address)
  epochs: "0xc6b61e4c", // epochs(uint256)
  // VVakePrizePool
  totalFunded: "0xad044f49", // totalFunded()
  totalSpent: "0xfb346eab", // totalSpent()
  totalBought: "0x4a91f195", // totalBought()
  buyCount: "0xca703075", // buyCount()
  nextBuyAt: "0x61fe2120", // nextBuyAt()
  nextBuyAmount: "0xeff5bb1c", // nextBuyAmount()
  paused: "0x5c975abb", // paused()
} as const;

export const TOPIC = {
  /** Funded(address indexed from, uint256 amount, bytes32 indexed reportHash) */
  funded: "0x12726590091af7424ad4dcce7018769ee0fb0f7c01cbd87309fc395dce5d096e",
  /** Bought(address indexed caller, uint256 indexed buyIndex, uint256 ethIn, uint256 vvakeOut, uint160, uint160, address) */
  bought: "0x9c1f1a955088067f16ed7e864d9137db2133cfbe1d4e38321aa109354ee7c296",
} as const;

const strip = (hex: string) => hex.replace(/^0x/, "").toLowerCase();

/** One 32-byte word (64 hex chars, no 0x) for an unsigned integer. */
export function word(n: bigint | number): string {
  const v = BigInt(n);
  if (v < 0n || v >= 1n << 256n) throw new RangeError("uint256 out of range");
  return v.toString(16).padStart(64, "0");
}

/** A left-padded address word. */
export function addressWord(address: string): string {
  const a = strip(address);
  if (!/^[0-9a-f]{40}$/.test(a)) throw new TypeError("not an address");
  return a.padStart(64, "0");
}

function bytes32Word(hex: string): string {
  const h = strip(hex);
  if (!/^[0-9a-f]{64}$/.test(h)) throw new TypeError("not a bytes32");
  return h;
}

/** A dynamic array of static words: length, then the items. */
const staticArray = (items: string[]) => word(items.length) + items.join("");

/** A dynamic array of dynamic items: length, offsets (from after the length), then the items. */
function dynamicArray(items: string[]): string {
  let offset = items.length * 32;
  const heads: string[] = [];
  for (const item of items) {
    heads.push(word(offset));
    offset += item.length / 2;
  }
  return word(items.length) + heads.join("") + items.join("");
}

/** Encodes a tuple of head parts: `static` words go in place, `dynamic` ones get an offset and follow. */
function tuple(parts: ({ static: string } | { dynamic: string })[]): string {
  let offset = parts.length * 32;
  let head = "";
  let tail = "";
  for (const p of parts) {
    if ("static" in p) head += p.static;
    else {
      head += word(offset);
      tail += p.dynamic;
      offset += p.dynamic.length / 2;
    }
  }
  return head + tail;
}

export const isClaimedCalldata = (epoch: number, account: string) => SELECTOR.isClaimed + word(epoch) + addressWord(account);

export const claimCalldata = (epoch: number, account: string, amount: bigint, proof: string[]) =>
  SELECTOR.claim +
  tuple([
    { static: word(epoch) },
    { static: addressWord(account) },
    { static: word(amount) },
    { dynamic: staticArray(proof.map(bytes32Word)) },
  ]);

export interface ClaimLeaf {
  epoch: number;
  amount: bigint;
  proof: string[];
}

/** claimMany(epochs, account, amounts, proofs): several weeks for one account, one transfer. */
export const claimManyCalldata = (account: string, leaves: ClaimLeaf[]) =>
  SELECTOR.claimMany +
  tuple([
    { dynamic: staticArray(leaves.map((l) => word(l.epoch))) },
    { static: addressWord(account) },
    { dynamic: staticArray(leaves.map((l) => word(l.amount))) },
    { dynamic: dynamicArray(leaves.map((l) => staticArray(l.proof.map(bytes32Word)))) },
  ]);

/** The `i`th 32-byte word of a return value or log data, as a bigint (0 when missing). */
export function readWord(hex: string, i = 0): bigint {
  const w = strip(hex).slice(i * 64, i * 64 + 64);
  return w.length === 64 ? BigInt("0x" + w) : 0n;
}

export const readBool = (hex: string) => readWord(hex) !== 0n;

/** The address in a 32-byte word (a topic or a data word), as 0x + 40 lower-case hex. */
export const wordToAddress = (w: string) => "0x" + strip(w).slice(-40);

export interface RpcLog {
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

export type PoolEvent =
  | { kind: "funded"; from: string; amount: bigint; reportHash: string; block: number; tx: string; index: number }
  | { kind: "bought"; caller: string; buyIndex: bigint; ethIn: bigint; vvakeOut: bigint; block: number; tx: string; index: number };

/** A Funded or Bought log of the prize pool, or null for anything else. */
export function decodePoolLog(log: RpcLog): PoolEvent | null {
  const t0 = log.topics[0]?.toLowerCase();
  const at = { block: Number(BigInt(log.blockNumber)), tx: log.transactionHash, index: Number(BigInt(log.logIndex)) };
  if (t0 === TOPIC.funded && log.topics.length === 3) {
    return {
      kind: "funded",
      from: wordToAddress(log.topics[1]!),
      amount: readWord(log.data, 0),
      reportHash: log.topics[2]!.toLowerCase(),
      ...at,
    };
  }
  if (t0 === TOPIC.bought && log.topics.length === 3) {
    return {
      kind: "bought",
      caller: wordToAddress(log.topics[1]!),
      buyIndex: BigInt(log.topics[2]!),
      ethIn: readWord(log.data, 0),
      vvakeOut: readWord(log.data, 1),
      ...at,
    };
  }
  return null;
}

/** Base units → "1,234.5" style text with at most `maxFraction` decimals (truncated, never rounded up). */
export function formatUnits(value: bigint, decimals: number, maxFraction = 4, locale = "en"): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  const sep = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
  const wholeText = new Intl.NumberFormat(locale).format(whole);
  return (neg ? "-" : "") + wholeText + (frac ? sep + frac : "");
}

/** UTF-8 text → 0x hex (what personal_sign expects). */
export const utf8ToHex = (text: string) => "0x" + [...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2, "0")).join("");
