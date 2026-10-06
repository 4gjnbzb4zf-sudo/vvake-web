/**
 * The wallet-link message, read before it's signed (VV-07). The page shows its key lines (site, VVake account,
 * wallet, network, expiry) and the full text, and won't ask the wallet to sign a message that names another wallet,
 * another chain or another site.
 *
 * Reads both the API's current format ("Wallet: 0x…", "Chain ID: n") and EIP-4361 (Sign-In with Ethereum: first line
 * "<domain> wants you to sign in with your Ethereum account:", the address on the next line, then "URI:", "Chain ID:",
 * "Expiration Time:"…), so a SIWE message from the API shows its domain and URI as soon as the API sends one.
 */

export interface LinkMessageView {
  /** EIP-4361 domain, when the message has one. */
  domain: string | null;
  uri: string | null;
  wallet: string | null;
  chainId: number | null;
  expires: string | null;
  /** A "VVake account:" line, when the API binds the account in the message. */
  account: string | null;
  siwe: boolean;
}

export type LinkProblem = "wallet" | "chain" | "domain";

const SIWE_HEAD = /^(\S+) wants you to sign in with your Ethereum account:$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function readLinkMessage(message: string): LinkMessageView {
  const lines = message.split(/\r?\n/);
  const field = (name: string) => {
    const prefix = `${name}:`;
    const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
    return line ? line.slice(prefix.length).trim() : null;
  };
  const head = SIWE_HEAD.exec(lines[0]?.trim() ?? "");
  const siweAddress = head && ADDRESS.test(lines[1]?.trim() ?? "") ? lines[1]!.trim() : null;
  const wallet = siweAddress ?? field("Wallet");
  const chain = field("Chain ID");
  return {
    domain: head ? head[1]! : null,
    uri: field("URI"),
    wallet: wallet && ADDRESS.test(wallet) ? wallet : null,
    chainId: chain && /^\d+$/.test(chain) ? Number(chain) : null,
    expires: field("Expiration Time"),
    account: field("VVake account") ?? field("Account"),
    siwe: Boolean(head),
  };
}

/**
 * Why this message must not be signed here: it names no wallet or another wallet than the connected one, no chain
 * or another chain than the rewards chain, or (EIP-4361) a domain other than the site the visitor is on.
 */
export function linkMessageProblems(view: LinkMessageView, expected: { account: string; chainId: number; host: string }): LinkProblem[] {
  const problems: LinkProblem[] = [];
  if (!view.wallet || view.wallet.toLowerCase() !== expected.account.toLowerCase()) problems.push("wallet");
  if (view.chainId !== expected.chainId) problems.push("chain");
  if (view.domain !== null && view.domain.toLowerCase() !== expected.host.toLowerCase()) problems.push("domain");
  return problems;
}
