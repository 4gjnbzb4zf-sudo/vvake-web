# Security

Please report vulnerabilities privately through GitHub:
**https://github.com/4gjnbzb4zf-sudo/vvake-web/security/advisories/new** (private vulnerability reporting). Do not
open public issues for security reports.

VVake will **never** message you first, and never asks for a seed phrase, a private key, a code from the app or a
token approval. A prize claim only calls `claim()` (or `claimMany()`) on the rewards contract below and sends 0 ETH.

## Official addresses

Anything not on this list is not VVake.

- Website: `vvake.com` (the only official domain). Prizes are claimed only on `https://vvake.com/rewards`.
- API: `https://vvake-api.val-54e.workers.dev` (the only API host).
- Contracts on Robinhood Chain Testnet (chain ID 46630, explorer `https://explorer.testnet.chain.robinhood.com`):
  - VVakeRewards (weekly prize claims): `0xEF0D0c1c32D56A50dc1addc6471772F9E4a2aE0F`
  - VVakePrizePool: `0xDb99d6C7a5866a20705116d6a1a299A951d9C39C`
  - $VVAKE token: `0x2b85b57383bA4C7eDABf6289E6bfe3a9C4833Cde`

## Engineering practices in this repo

- Static site, no server runtime, no cookies, no third-party analytics or scripts.
- Content-Security-Policy on every page (hashes of the inline scripts, fetches limited to the API and the chain RPC),
  written at build time by `scripts/csp.ts`; the rewards page hides itself inside a frame.
- The claim transaction is built in the browser from the pinned contract address; nothing from the API can change
  its target, its function or its value.
- GitHub Actions pinned to commit SHAs; `npm ci --ignore-scripts` in CI; Dependabot for npm and Actions.
- Least-privilege workflow permissions; Pages deploy via OIDC (`id-token: write`) only in the deploy job.
