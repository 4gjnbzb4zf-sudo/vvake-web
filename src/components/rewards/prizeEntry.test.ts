import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { ClaimItem, EntryChoice, SkillCard } from "./PrizeEntry";

const dicts = { en: en.rewards, fr: fr.rewards };
const decode = (html: string) =>
  html
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
const date = (iso: string) => iso.slice(0, 10);
const noop = () => {};

function entry(lang: "en" | "fr", over: Partial<Parameters<typeof EntryChoice>[0]> = {}) {
  return decode(
    renderToStaticMarkup(
      createElement(EntryChoice, {
        dict: dicts[lang].entry,
        signedIn: true,
        entry: { plus: false, free: null },
        plusActive: false,
        busy: false,
        msg: null,
        date,
        onEnter: noop,
        onWithdraw: noop,
        ...over,
      }),
    ),
  );
}

describe("two ways in, same prize", () => {
  it.each(["en", "fr"] as const)("(%s) Plus and the free entry side by side, with the same card style", (lang) => {
    const t = dicts[lang].entry;
    const html = entry(lang);
    expect(html).toContain(t.title);
    expect(html).toContain(t.plus.title);
    expect(html).toContain(t.free.title);
    // Equal dignity: both ways are rendered with the exact same card classes.
    const cards = [...html.matchAll(/<div class="([^"]*)" data-way="(plus|free)"/g)];
    expect(cards.map((m) => m[2])).toEqual(["plus", "free"]);
    expect(cards[0]![1]).toBe(cards[1]![1]);
    expect(html).toMatch(new RegExp(`<button[^>]*>${t.free.enter}</button>`));
  });

  it("not entered: one tap enters; entered: counts from the next Monday, and a withdraw button", () => {
    expect(entry("en")).not.toContain(en.rewards.entry.free.withdraw);
    const html = entry("en", {
      entry: { plus: false, free: { enteredAt: "2026-10-06T10:00:00Z", countsFrom: "2026-10-12T00:00:00.000Z" } },
    });
    expect(html).toContain(en.rewards.entry.free.on);
    expect(html).toContain("Counts from the week of 2026-10-12");
    expect(html).toContain(en.rewards.entry.free.withdraw);
    expect(html).not.toMatch(new RegExp(`<button[^>]*>${en.rewards.entry.free.enter}</button>`));
  });

  it("Plus: in with paid Plus; beta Plus is told to use the free entry", () => {
    expect(entry("en", { entry: { plus: true, free: null }, plusActive: true })).toContain(en.rewards.entry.plus.on);
    expect(entry("en", { entry: { plus: false, free: null }, plusActive: true })).toContain(en.rewards.entry.plus.beta);
    expect(entry("en")).toContain(en.rewards.entry.plus.off);
  });

  it("signed out: the rule and a sign-in hint, no button", () => {
    const html = entry("en", { signedIn: false, entry: undefined });
    expect(html).toContain(en.rewards.entry.free.signIn);
    expect(html).not.toContain("<button");
  });
});

function skill(lang: "en" | "fr", s: Parameters<typeof SkillCard>[0]["skill"], msg: string | null = null) {
  return decode(
    renderToStaticMarkup(createElement(SkillCard, { dict: dicts[lang].skill, skill: s, busy: false, msg, date, onAnswer: noop })),
  );
}

describe("the weekly skill question", () => {
  it.each(["en", "fr"] as const)("(%s) the question, a numeric answer, tries left and why it's asked", (lang) => {
    const t = dicts[lang].skill;
    const html = skill(lang, { epoch: 2961, answered: false, answeredAt: null, attemptsLeft: 4, question: "7 × 8 + 12 − 4" });
    expect(html).toContain(t.title);
    expect(html).toContain("7 × 8 + 12 − 4 = ?");
    expect(html).toMatch(/<input[^>]*inputMode="numeric"/i);
    expect(html).toContain(t.tries.replace("{n}", "4"));
    expect(html).toContain(t.why);
    expect(t.why).toMatch(lang === "en" ? /Canadian law/ : /loi canadienne/);
  });

  it("answered: a success state, no input", () => {
    const html = skill("en", { epoch: 2961, answered: true, answeredAt: "2026-10-06T12:00:00Z", attemptsLeft: 4 });
    expect(html).toContain("Answered 2026-10-06");
    expect(html).not.toContain("<input");
  });

  it("no tries left, loading, unavailable, and a wrong answer's message", () => {
    expect(skill("en", { epoch: 1, answered: false, answeredAt: null, attemptsLeft: 0 })).toContain(en.rewards.skill.none);
    expect(skill("en", undefined)).toContain(en.rewards.loading);
    expect(skill("en", null)).toContain(en.rewards.skill.unavailable);
    const wrong = skill("en", { epoch: 1, answered: false, answeredAt: null, attemptsLeft: 3, question: "2 + 2" }, en.rewards.skill.wrong);
    expect(wrong).toContain(en.rewards.skill.wrong);
  });
});

describe("claims open 48 h after posting", () => {
  const e = { epoch: 7, startsAt: "2026-09-28T00:00:00Z", amount: "12.5", address: "0x" + "11".repeat(20) };
  const render = (opensAt: string | null) =>
    decode(
      renderToStaticMarkup(
        createElement(ClaimItem, {
          dict: en.rewards.claim,
          e,
          title: "Sep 28 · 12.5 VVAKE",
          opensAt,
          disabled: false,
          onClaim: noop,
        }),
      ),
    );

  it("before claimableAt: 'Claimable from …' and the claim button disabled", () => {
    const html = render("Oct 8, 2026, 2:00 PM");
    expect(html).toContain("Claimable from Oct 8, 2026, 2:00 PM");
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>${en.rewards.claim.one}</button>`));
  });

  it("once open: the button works", () => {
    const html = render(null);
    expect(html).not.toContain("Claimable from");
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });
});

/** Words that would say prizes are only for Plus, in either language. */
const PLUS_ONLY =
  /plus[- ]only|only for (?:vvake fit )?plus|prizes are only for|for plus subscribers with|plus subscribers with a linked wallet|réservés aux abonnés|pour les abonnés plus|aux abonnés plus avec|les abonnés plus avec|sans plus, tu gardes|free accounts keep the coach/i;

describe("prize copy: Plus or the free entry, everywhere (EN and FR)", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("(%s) no Plus-only claim left in any page's copy", (_lang, d) => {
    expect(JSON.stringify(d)).not.toMatch(PLUS_ONLY);
  });

  it("the rules say it all: free entry, heart rate, before the week, skill question, 150 a day, 10%", () => {
    const how = JSON.stringify(en.rewards.how) + en.rewards.mine.rule;
    for (const s of ["free entry", "same prize", "heart-rate", "before the week", "skill question", "150", "10%", "48 hours"])
      expect(how).toContain(s);
    const howFr = JSON.stringify(fr.rewards.how) + fr.rewards.mine.rule;
    for (const s of [
      "inscription gratuite",
      "même prix",
      "fréquence cardiaque",
      "avant le début de la semaine",
      "question d'habileté",
      "150",
      "10 %",
      "48 heures",
    ])
      expect(howFr).toContain(s);
  });

  it("the backers page, the FAQ and the earn card mention the free entry", () => {
    expect(JSON.stringify(en.rwa)).toContain("free entry");
    expect(JSON.stringify(fr.rwa)).toContain("inscription gratuite");
    expect(JSON.stringify(en.faq)).toContain("free entry");
    expect(JSON.stringify(fr.faq)).toContain("inscription gratuite");
    expect(JSON.stringify(en.earn)).toContain("free entry");
    expect(JSON.stringify(fr.earn)).toContain("inscription gratuite");
  });

  it("no earn / yield / investment wording in the new prize copy, and FR uses tutoiement", () => {
    const newEn = JSON.stringify({ e: en.rewards.entry, s: en.rewards.skill, m: en.rewards.mine, h: en.rewards.how });
    expect(newEn).not.toMatch(/\bearn|\byield|\bwin\b|\blottery|\bluck/i);
    const newFr = JSON.stringify({ e: fr.rewards.entry, s: fr.rewards.skill, m: fr.rewards.mine });
    expect(newFr).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
  });
});
