import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { RewardsSession } from "@/lib/rewardsApi";
import { OwnWalletGuide, PasskeyWallet } from "./PasskeyWallet";

const dicts = { en: en.rewards, fr: fr.rewards };
const decode = (html: string) =>
  html
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

const b64 = (n: number) => Buffer.from(new Uint8Array(n).fill(7)).toString("base64url");
const VAULT = {
  version: 1 as const,
  credentialId: b64(16),
  salt: b64(32),
  iv: b64(12),
  ciphertext: b64(48),
  address: "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf",
};

function card(lang: "en" | "fr", over: Partial<Parameters<typeof PasskeyWallet>[0]> = {}) {
  const t = dicts[lang];
  return decode(
    renderToStaticMarkup(
      createElement(PasskeyWallet, {
        dict: t.wallet,
        claimDict: t.claim,
        errors: t.errors,
        session: new RewardsSession("https://api.invalid"),
        vault: null,
        vaultError: false,
        onVault: () => {},
        rpId: "vvake.com",
        linked: null,
        adult: false,
        onAdult: () => {},
        onLink: () => {},
        review: null,
        busy: false,
        lang,
        ...over,
      }),
    ),
  );
}

describe("the passkey wallet card", () => {
  it.each(["en", "fr"] as const)("no wallet yet (%s): explains it and, without WebAuthn here, points to the own-wallet guide", (lang) => {
    const html = card(lang);
    expect(html).toContain(dicts[lang].wallet.passkey.intro);
    // Server render: no navigator.credentials, so no create button, a clear explanation and the guide link instead.
    expect(html).toContain(dicts[lang].wallet.passkey.unavailable);
    expect(html).toContain('href="#own-wallet"');
  });

  it.each(["en", "fr"] as const)("with a wallet (%s): full address, export / move / delete, delete disabled until acknowledged", (lang) => {
    const t = dicts[lang].wallet.passkey;
    const html = card(lang, { vault: VAULT });
    expect(html).toContain(VAULT.address);
    expect(html).toContain(t.export.button);
    expect(html).toContain(t.move.button);
    expect(html).toContain(t.delete.ack);
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>${t.delete.button}</button>`));
    // Never the key: nothing on the card before an export.
    expect(html).not.toContain(t.export.shown);
  });

  it("with a linked passkey wallet: says so, no link button", () => {
    const html = card("en", { vault: VAULT, linked: VAULT.address.toLowerCase() });
    expect(html).toContain(en.rewards.wallet.passkey.linked);
    expect(html).not.toContain(en.rewards.wallet.passkey.link + "<");
  });

  it("SEC-W15 the export warning says the four things it must say (EN and FR, tutoiement)", () => {
    const w = en.rewards.wallet.passkey.export.warning;
    expect(w).toContain("Anyone with this key controls your prizes");
    expect(w).toContain("Never share it");
    expect(w).toContain("VVake will never ask for it");
    const f = fr.rewards.wallet.passkey.export.warning;
    expect(f).toContain("Toute personne qui a cette clé contrôle tes prix");
    expect(f).toContain("Ne la partage jamais");
    expect(f).toContain("VVake ne te la demandera jamais");
    expect(f).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });
});

describe("Use my own wallet guide", () => {
  it.each(["en", "fr"] as const)("(%s) Rabby / MetaMask / Ledger, the testnet settings, offline phrase, VVake never asks", (lang) => {
    const html = decode(renderToStaticMarkup(createElement(OwnWalletGuide, { dict: dicts[lang].wallet.own })));
    for (const s of [
      "Rabby",
      "MetaMask",
      "Ledger",
      "46630",
      "https://rpc.testnet.chain.robinhood.com",
      "https://explorer.testnet.chain.robinhood.com",
      'id="own-wallet"',
      dicts[lang].wallet.own.never,
    ])
      expect(html).toContain(s);
    if (lang === "fr") expect(html).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });

  it("every new French string uses tutoiement", () => {
    const text = JSON.stringify({ p: fr.rewards.wallet.passkey, o: fr.rewards.wallet.own, e: fr.rewards.errors });
    expect(text).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });
});
