# Security

Please report vulnerabilities privately to **security@vvake.com**. Do not open public issues for security reports.

VVake will **never** ask for a seed phrase or private key, and never DMs first. Official domains: `vvake.com`, `vvake.fr`, `vvake.app`.

Engineering practices in this repo:

- Static site, no server runtime, no cookies, no third-party analytics or scripts.
- GitHub Actions pinned to commit SHAs; `npm ci --ignore-scripts` in CI; Dependabot for npm and Actions.
- Least-privilege workflow permissions; Pages deploy via OIDC (`id-token: write`) only in the deploy job.
