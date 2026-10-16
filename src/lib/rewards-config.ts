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
  /** VVakeRewards v2 (deployed at block 129911872; claims open 48 h after a weekly root). Empty: taken from the API when it has one. */
  rewardsContract: "0xEF0D0c1c32D56A50dc1addc6471772F9E4a2aE0F",
  /** VVakePrizePool. Empty: "not deployed yet". */
  prizePool: "0xDb99d6C7a5866a20705116d6a1a299A951d9C39C",
  /** The block the prize pool was deployed at (where the event scan stops). */
  prizePoolFromBlock: 129913044,
  /** Blocks per eth_getLogs call (the API's VVAKE_LOG_SPAN) and how many calls one page view makes at most. */
  logSpan: 2_000_000,
  maxLogWindows: 8,
} as const;

/**
 * $VVAKE v2 (ADR-0042): the relaunch on vibe/vibe, Robinhood Chain Testnet. Fill in this one place once the token is
 * live; while it is null, the backers page says the address is "posted here once live".
 * Until then `rewardsConfig.token` stays the old (retired) testnet token the deployed rewards contracts pay out.
 */
export const VVAKE_V2_ADDRESS: string | null = "0x6F5F7Dc8d9E03E22B20dAbd17075609812D53236";

/**
 * The OG v1 holders claim (ADR-0042, monorepo docs/03-economy/og-drop/): 50,000,000 v2 $VVAKE for the wallets that
 * bought v1, claimed once per wallet from VVakeOGClaim (contracts/src/VVakeOGClaim.sol, no admin). The list is
 * public/og-drop/og-drop-claims.json, copied byte for byte from the monorepo.
 *
 * Fill in `address` (and `openedAt`, the deployment block's unix time) once the contract is deployed and funded;
 * while `address` is null the claim says "opens soon". The page reads the real deadline from the contract.
 */
export const ogClaimConfig = {
  /** VVakeOGClaim on Robinhood Chain Testnet. Null: not deployed yet ("opens soon"). */
  address: "0xeee3d0dff5997086e490863671a617c30737651f" as string | null,
  /** Unix seconds of the deployment block (claims open then). Null until deployed. */
  openedAt: 1792180960 as number | null,
  /** Claim window from opening (the contract's deadline = deployment + 30 days). */
  windowDays: 30,
  /** The Merkle root the contract is deployed with; the page refuses a list with another root. */
  root: "0x736cf6b90d1aa6f1a34462e2f371d69ab388b3d69a15552d54d3abbbd0a9ed80",
  /** 50,000,000 × 10^18. */
  total: "50000000000000000000000000",
  /** Where unclaimed tokens go after the deadline (the team's reserve for community events): the creator wallet. */
  reserve: "0xF29c27A1F77800414A163E635c0381da76352804",
  /** The published list (static files). */
  listUrl: "/og-drop/og-drop-claims.json",
  csvUrl: "/og-drop/og-drop.csv",
  /** The snapshot block on v1. */
  snapshotBlock: 136764295,
};

/** The retired v1 testnet token, shown as retired next to the v2 slot. */
export const VVAKE_V1_RETIRED_ADDRESS = "0x2b85b57383bA4C7eDABf6289E6bfe3a9C4833Cde";

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
