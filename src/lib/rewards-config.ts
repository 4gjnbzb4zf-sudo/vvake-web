/**
 * $VVAKE rewards on the web (vvake.com/rewards): the chain and the two open-source contracts
 * (monorepo `contracts/`: VVakeRewards, the weekly Merkle distributor, and VVakePrizePool, the Plus-funded prize pool).
 *
 * Both are deployed on Robinhood Chain Testnet (2026-10-05). An empty address makes the on-chain parts of the page
 * say "not deployed yet" (kept as the fallback for a new network). The rewards contract set here wins; when empty,
 * the page takes the one the API reports (GET /v1/rewards when signed in, the public epoch lists otherwise).
 * The prize pool isn't in the API (yet), so its address lives only here.
 */
export const rewardsConfig = {
  /** Robinhood Chain Testnet. */
  chain: {
    id: 46630,
    idHex: "0xb626",
    name: "Robinhood Chain Testnet",
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    explorerUrl: "https://explorer.testnet.chain.robinhood.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  /** $VVAKE (ERC-20, 18 decimals). */
  token: "0x2b85b57383bA4C7eDABf6289E6bfe3a9C4833Cde",
  decimals: 18,
  /** VVakeRewards (deployed at block 129456532). Empty: taken from the API when it has one. */
  rewardsContract: "0x1B600A1b835E95b1c9D91B8f29aC82ac37D5718b",
  /** VVakePrizePool. Empty: "not deployed yet". */
  prizePool: "0x38F40804369df4EF90e9ac3d82BfB392F57dA4Fe",
  /** The block the prize pool was deployed at (where the event scan stops). */
  prizePoolFromBlock: 129457171,
  /** Blocks per eth_getLogs call (the API's VVAKE_LOG_SPAN) and how many calls one page view makes at most. */
  logSpan: 2_000_000,
  maxLogWindows: 8,
} as const;

export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** The first well-formed address, or null (config first, then what the API said). */
export function pickAddress(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) if (c && ADDRESS.test(c)) return c;
  return null;
}

export const explorerTx = (hash: string) => `${rewardsConfig.chain.explorerUrl}/tx/${hash}`;
export const explorerAddress = (address: string) => `${rewardsConfig.chain.explorerUrl}/address/${address}`;

/** "0x2b85…3Cde". */
export const shortHex = (hex: string, head = 6, tail = 4) =>
  hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;

// ── Weekly epochs (same numbering as the API: services/api/src/rewards/config.ts) ─────────────────────────────

const WEEK_MS = 7 * 86_400_000;
/** Monday 1970-01-05 00:00 UTC: epoch 0. Epoch n is the UTC week [EPOCH0 + n weeks, + 1 week). */
const EPOCH0_MS = Date.UTC(1970, 0, 5);
export const epochOf = (ms: number) => Math.floor((ms - EPOCH0_MS) / WEEK_MS);
export const epochStart = (epoch: number) => new Date(EPOCH0_MS + epoch * WEEK_MS);

/**
 * GitHub Pages can't serve /rewards (pages live under /<lang>/), so the 404 page sends /rewards to /<lang>/rewards/.
 * Dependency-free: serialised into the 404 page's inline script.
 */
export function rewardsRedirect(pathname: string, lang: string): string | null {
  return /^\/rewards\/?$/.test(pathname) ? "/" + lang + "/rewards/" : null;
}
