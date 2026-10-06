# Copy guardrails (read before editing any text)

VVake is a fitness and training service, not a financial product. Full rules live in the private monorepo
(`docs/04-compliance/constraints.md`, `docs/06-brand/storytelling.md` §9).

| ❌ Never                                                           | ✅ Instead                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------ |
| passive income, get paid to run, ROI, APY, yield, "earn" as income | rewards, perks, prizes for moving funded by real revenue     |
| the token will go up, moon, early = rich, buyback                  | be early to the community, Founding Movers, public fee split |
| invest in Nike, bet on your team, stock prizes                     | follow your Brand Team, rally when it moves                  |
| brand slogans, logos, "World Cup", "Original Six", club crests     | our own lines; factual team names and tickers only           |
| "official Vibe Vibe / Robinhood project"                           | nothing, until a partnership is signed                       |
| guaranteed, risk-free                                              | nothing                                                      |

Pair "wealth" with **"health is the first wealth"**, never with prices or charts going up.

## Referencing vibe/vibe (until a partnership is signed)

- Text only: "vibe/vibe", "v/v". Never their chef-hat logo, characters, colors-as-brand or screenshots.
- Always keep the independence line ("not affiliated with or endorsed by vibe/vibe").
- No token details, prices, dates or calls to buy. "Nothing to buy" stays next to the link.
- The link goes to their public site only. No wallet connection anywhere on our pages except vvake.com/rewards (below).

## $VVAKE prizes (ADR-0022, ADR-0023)

VVake now gives weekly $VVAKE **prizes for moving**, claimed by each person from an open-source contract with their
own wallet. Testnet today. The safety intent of the old "never connect a wallet" rule stays: nobody should ever lose
keys or funds because of a VVake page.

**Wallets**

- Wallet connection is allowed **only on vvake.com/rewards** (`/[lang]/rewards/`), nowhere else on the site.
- Only an injected wallet the visitor owns (browser extension or a wallet app's browser). We ask it for two things
  only: a free `personal_sign` of our link message, and the visitor's own `claim` / `claimMany` transaction.
- We never ask for, accept or display a seed phrase, recovery phrase or private key, in any form, field or support
  reply. The rewards page says so next to the connect button.
- VVake never custodies tokens and never holds funds for anyone: no in-app balance, no deposit address, no
  withdrawals, no "send us tokens". Prizes go from the contract straight to the address in the weekly list.

**What prizes are**

- Weekly $VVAKE prizes are only for **paying VVake Fit Plus subscribers with a linked wallet** (founder decision,
  2026-10-06). A week counts if all are true: Plus active that week; a wallet linked on vvake.com/rewards; 18+
  confirmed when linking; real effort that week (at least 3 counted sessions or 90 active minutes). Move Quests don't
  count toward prizes for now. Free accounts keep everything else (coach, streaks, points, quests), just not the
  token prizes. Never write "free accounts are eligible" again.
- Prizes are for effort only: VV points capped per day. No draw, no chance, no lottery wording.
- Weekly pot: 1/8 of the VVAKE the rewards contract holds and hasn't promised yet, capped at 1,000,000 VVAKE a week;
  unawarded VVAKE stays in the pool for later weeks. Split by effort points; nobody gets more than 10% of a week's pot,
  the rest goes to the others or stays in the pool.
- Never proportional to what someone pays (everyone pays the same Plus price) and never to token holdings; no bonus
  for gear, collectibles or holding $VVAKE. Plus is the condition to take part, never a multiplier.
- Testnet tokens have no value. Say so wherever the tokens appear.
- Prizes are 18+ (conservative default): only people 18 or older who are allowed to receive prizes where they live.
  vvake.com/rewards asks the visitor to tick "I'm 18 or older and allowed to receive prizes where I live" before the
  link-wallet button works; the link request sends `adult: true` and the API requires it. Say 18+ wherever the prize
  rules are explained.
- Paying Plus with testnet $VVAKE exists only in development builds of the app (App Store 3.1.1), never in TestFlight
  or the App Store; the site may mention it only as that, with no burn-for-price framing.
- VVake Fit Plus funds a monthly prize pool: a fixed, published share of net Plus revenue (ADR-0023), converted to
  VVAKE by rule on chain (capped chunks, permissionless trigger), sent straight to the rewards contract, and published
  (monthly report, `Funded` / `Bought` events, weekly lists). Plus never buys anyone a bigger prize.
- Legal review and an external audit of the contracts come before any mainnet value. Testnet today: no value.

**Language**

| ❌ Never                                                                  | ✅ Instead                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| earn, earnings, yield, investment, returns, income, APY                   | prizes, weekly prizes, prizes for moving                      |
| price going up, moon, "the more you hold…", buyback, burn for price       | prize pool funded by Plus, conversions by rule                |
| a USD (or any fiat) value of the pool, a prize or the token; price charts | amounts in ETH and VVAKE as read from the chain, testnet      |
| "hold VVAKE to win more", "Plus = more prizes", "free accounts eligible"  | "for Plus subscribers, shared by effort", "never by holdings" |
| draw, lottery, chance, "win", "lucky"                                     | "prizes for effort", "shared by effort points"                |

- Talk about "prizes", "prize pool", "conversions" (ETH → VVAKE for prizes). Never call a conversion a buyback and
  never connect it to the token's price. Nothing is burned for price or sent to holders.
- Keep "Nothing to buy here", "not an offer or investment advice" and "testnet: no value" near any token amount.

**In the apps (App Store 3.1.5)**

- Points and read-only rewards information only (this week's points, past weeks' amount and claim status, the linked
  wallet shortened). No wallet connection, signing, claim, swap, or button or link out to a crypto flow. The app may
  say in plain text "Claim on vvake.com with your wallet". The app doesn't say that Plus revenue buys a token.
- The server switch `REWARDS_IN_APP = "0"` hides the screen without an app update.

**Before mainnet value**

- Legal review per launch country (securities, money transmission, contests / sweepstakes, consumer protection, tax)
  and an external audit of the contracts, before $VVAKE prizes have any mainnet value. Not offered in the US or UK at
  launch (ADR-0020) until that review says otherwise.
