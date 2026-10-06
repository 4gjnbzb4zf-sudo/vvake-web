import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { FRAME_GUARD_SCRIPT } from "@/lib/frameGuard";
import { linkMessageProblems, readLinkMessage } from "@/lib/linkMessage";
import { rewardsConfig } from "@/lib/rewards-config";
import { RewardsSession } from "@/lib/rewardsApi";
import { LinkReview, SignIn } from "./RewardsAccount";
import { FrameGuard, ScamWarning } from "./Safety";

const dicts = { en: en.rewards, fr: fr.rewards };
const decode = (html: string) =>
  html
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** Runs the inline frame guard against a fake window/document (no jsdom in this repo); returns the <html> attributes. */
function runGuard(framed: "top" | "frame" | "throws") {
  const attrs: Record<string, string> = {};
  const self = {};
  const window: Record<string, unknown> = { self };
  if (framed === "top") window.top = self;
  else if (framed === "frame") window.top = {};
  else
    Object.defineProperty(window, "top", {
      get() {
        throw new Error("SecurityError");
      },
    });
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  runInNewContext(FRAME_GUARD_SCRIPT, { window, document });
  return attrs;
}

describe("VV-12 frame guard", () => {
  it("VV-12 the top window is marked data-unframed", () => {
    expect(runGuard("top")).toEqual({ "data-unframed": "" });
  });

  it("VV-12 inside a frame (or when the check throws) nothing is marked, so the rewards content stays hidden", () => {
    expect(runGuard("frame")).toEqual({});
    expect(runGuard("throws")).toEqual({});
  });

  it("VV-12 the CSS hides guarded content unless the page is the top window", () => {
    const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8").replace(/\s+/g, " ");
    expect(css).toContain(
      "html:not([data-unframed]) [data-frame-guard], html[data-unframed] [data-frame-notice] { display: none !important; }",
    );
  });

  it("VV-12 the [lang] layout runs the guard in <head> on every page", () => {
    const layout = readFileSync(join(__dirname, "..", "..", "app", "[lang]", "layout.tsx"), "utf8");
    expect(layout).toMatch(/<head>[\s\S]*__html: FRAME_GUARD_SCRIPT[\s\S]*<\/head>/);
  });

  it.each(["en", "fr"] as const)("VV-12 FrameGuard (%s) wraps the content and links to vvake.com/rewards when framed", (lang) => {
    const html = decode(
      renderToStaticMarkup(
        createElement(
          FrameGuard,
          { dict: dicts[lang].framed, href: `https://vvake.com/${lang}/rewards/` },
          createElement("p", null, "secret"),
        ),
      ),
    );
    expect(html).toMatch(/<div data-frame-guard=""><p>secret<\/p><\/div>/);
    expect(html).toContain(`href="https://vvake.com/${lang}/rewards/" target="_blank" rel="noopener noreferrer"`);
    expect(html).toContain(dicts[lang].framed.link);
  });
});

describe("Anti-scam banner on /rewards", () => {
  it("ANTI-SCAM English text, with the pinned contract shortened", () => {
    const html = decode(renderToStaticMarkup(createElement(ScamWarning, { dict: en.rewards.scam })));
    expect(html).toContain(
      "VVake never messages you first, never asks for a seed phrase, a private key, an app code or a token approval. A claim only calls claim() on 0xEF0D…aE0F and sends 0 ETH.",
    );
  });

  it("ANTI-SCAM French text (tutoiement), with the pinned contract shortened", () => {
    const html = decode(renderToStaticMarkup(createElement(ScamWarning, { dict: fr.rewards.scam })));
    expect(html).toContain("VVake ne t'écrit jamais en premier");
    expect(html).toContain("ta phrase de récupération, ta clé privée, un code de l'app ni une autorisation de dépense de tes tokens");
    expect(html).toContain("claim() sur 0xEF0D…aE0F et envoie 0 ETH");
    expect(html).not.toMatch(/\bvous\b|\bvotre\b/i);
  });

  it("ANTI-SCAM the rewards page renders the banner", () => {
    const page = readFileSync(join(__dirname, "..", "..", "app", "[lang]", "rewards", "page.tsx"), "utf8");
    expect(page).toContain("<ScamWarning dict={t.scam} />");
  });
});

describe("VV-03 app code sign-in warning", () => {
  it.each(["en", "fr"] as const)("VV-03 the app-code tab warns never to type a code someone asked for (%s)", (lang) => {
    const html = decode(
      renderToStaticMarkup(
        createElement(SignIn, {
          dict: dicts[lang],
          session: new RewardsSession("https://api.invalid"),
          onSignedIn: () => {},
          initialTab: "app",
        }),
      ),
    );
    const text =
      lang === "en"
        ? "Only type a code you just opened yourself in the VVake app. VVake will never ask you for it."
        : "Ne tape qu'un code que tu viens d'afficher toi-même dans l'app VVake. VVake ne te le demandera jamais.";
    expect(html).toContain(text);
    // The warning comes before the hint and the submit button.
    expect(html.indexOf(text)).toBeLessThan(html.indexOf('type="submit"'));
  });
});

const WALLET = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const API_MESSAGE = [
  "VVake wants you to link this wallet to your VVake account to receive $VVAKE rewards.",
  "",
  `Wallet: ${WALLET}`,
  `Chain ID: ${rewardsConfig.chain.id}`,
  "Nonce: abc123",
  "Issued At: 2026-10-06T07:00:00.000Z",
  "Expiration Time: 2026-10-06T07:10:00.000Z",
  "",
  "By signing, I confirm I am 18 or older.",
].join("\n");
const SIWE_MESSAGE = [
  "vvake.com wants you to sign in with your Ethereum account:",
  WALLET,
  "",
  "Link this wallet to your VVake account to receive $VVAKE prizes.",
  "",
  "URI: https://vvake.com/rewards",
  "Version: 1",
  `Chain ID: ${rewardsConfig.chain.id}`,
  "Nonce: abc123",
  "Issued At: 2026-10-06T07:00:00.000Z",
  "Expiration Time: 2026-10-06T07:10:00.000Z",
  "VVake account: me@example.com",
].join("\n");
const expected = { account: WALLET.toLowerCase(), chainId: rewardsConfig.chain.id, host: "vvake.com" };

describe("VV-07 the link message is shown before signing", () => {
  it("VV-07 reads the API's current message", () => {
    const view = readLinkMessage(API_MESSAGE);
    expect(view).toEqual({
      domain: null,
      uri: null,
      wallet: WALLET,
      chainId: 46630,
      expires: "2026-10-06T07:10:00.000Z",
      account: null,
      siwe: false,
    });
    expect(linkMessageProblems(view, expected)).toEqual([]);
  });

  it("VV-07 reads an EIP-4361 (SIWE) message: domain, URI and account binding", () => {
    const view = readLinkMessage(SIWE_MESSAGE);
    expect(view).toMatchObject({
      domain: "vvake.com",
      uri: "https://vvake.com/rewards",
      wallet: WALLET,
      account: "me@example.com",
      siwe: true,
    });
    expect(linkMessageProblems(view, expected)).toEqual([]);
  });

  it("VV-07 refuses a message for another wallet, chain or site", () => {
    const other = SIWE_MESSAGE.replace("vvake.com wants", "vvake-rewards.app wants")
      .replace(WALLET, "0x000000000000000000000000000000000000dEaD")
      .replace("Chain ID: 46630", "Chain ID: 1");
    expect(linkMessageProblems(readLinkMessage(other), expected)).toEqual(["wallet", "chain", "domain"]);
    expect(linkMessageProblems(readLinkMessage("Sign this"), expected)).toEqual(["wallet", "chain"]);
  });

  it.each(["en", "fr"] as const)("VV-07 the review shows site, account, wallet, network and the full message (%s)", (lang) => {
    const view = readLinkMessage(API_MESSAGE);
    const html = decode(
      renderToStaticMarkup(
        createElement(LinkReview, {
          dict: dicts[lang].wallet.review,
          review: { message: API_MESSAGE, view, problems: [] },
          who: "me@example.com",
          host: "vvake.com",
          busy: false,
          onSign: () => {},
          onCancel: () => {},
        }),
      ),
    );
    for (const s of [
      "vvake.com",
      "me@example.com",
      WALLET,
      "Robinhood Chain Testnet (46630)",
      "Nonce: abc123",
      dicts[lang].wallet.review.sign,
    ])
      expect(html).toContain(s);
  });

  it("VV-07 a mismatching message gets no sign button", () => {
    const view = readLinkMessage(API_MESSAGE);
    const html = decode(
      renderToStaticMarkup(
        createElement(LinkReview, {
          dict: en.rewards.wallet.review,
          review: { message: API_MESSAGE, view, problems: ["wallet"] },
          who: "me",
          host: "vvake.com",
          busy: false,
          onSign: () => {},
          onCancel: () => {},
        }),
      ),
    );
    expect(html).toContain(en.rewards.wallet.review.mismatch);
    expect(html).not.toContain(en.rewards.wallet.review.sign);
  });
});
