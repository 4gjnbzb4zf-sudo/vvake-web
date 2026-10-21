// Copied from VVFit packages/game-core/src/ugc.ts (322f91e 2026-10-21) by scripts/sync-camera-core.ts. Do not edit: re-sync.
/**
 * User-generated text (ADR-0047: custom move names, training names and descriptions, tags, public names): the
 * store rules (App Store 1.2, Google Play UGC policy) ask for a filter, reporting, blocking and takedown. This is the
 * filter, shared by the apps (said before saving) and the API (which refuses). It's deliberately small and strict:
 * no links, e-mail addresses or phone numbers (no spam, no personal data in public text), no markup, no money or
 * token talk (App Store 3.1.5: shared content never promises a reward), and a short list of slurs and obscenities in
 * English and French, matched on the normalised word (accents, case, leetspeak and repeated letters folded).
 * Reports and takedowns handle what a list can't.
 */

export type UgcProblem = "link" | "contact" | "markup" | "money" | "abuse" | "empty";

/** Folds a text for matching: lower case, no accents, 0→o 1→i 3→e 4→a 5→s 7→t @→a $→s, letters repeated 3+ times once. */
export function foldUgc(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/(\p{L})\1{2,}/gu, "$1");
}

// Stems matched at the start of a word (so "assassin" or "class" are fine: only whole words or listed stems count).
const ABUSE_WORDS = [
  // English
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "cunt",
  "bitch",
  "bastard",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retarded",
  "spastic",
  "tranny",
  "kike",
  "chink",
  "wetback",
  "paki",
  "rape",
  "rapist",
  "nazi",
  "hitler",
  "porn",
  "porno",
  "nude",
  "nudes",
  "kill yourself",
  "kys",
  // French
  "merde",
  "putain",
  "pute",
  "salope",
  "connard",
  "connasse",
  "encule",
  "enculer",
  "nique",
  "niquer",
  "batard",
  "couille",
  "couilles",
  "chatte",
  "pede",
  "tapette",
  "negre",
  "bougnoule",
  "youpin",
  "bicot",
  "gogol",
  "mongol",
  "triso",
  "viol",
  "violeur",
  "branleur",
  "fdp",
  "ntm",
  "suicide toi",
];
const ABUSE = new RegExp(`(^|[^\\p{L}])(${ABUSE_WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})(?=$|[^\\p{L}])`, "u");

const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|io|fr|be|ch|ca|co|app|me|gg|xyz|ly|tv|link|shop|store)\b|t\.me\/|discord\.gg)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const MARKUP = /[<>{}[\]\\`|^~]|[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/;
const MONEY =
  /token|crypto|wallet|portefeuille|\bprize|\bprix\b|jeton|reward|récompense|recompense|\bcash\b|\bcoins?\b|\bearn|\$vvake|\bvvake coin|airdrop|nft|bitcoin|ethereum|usdc|\bpaid\b|\bpay\b|payé|gagne[rz]? de l.argent|make money/i;

/** What's wrong with a public text (null: fine). */
export function ugcProblem(text: string): UgcProblem | null {
  const t = text.normalize("NFC").trim();
  if (!t) return "empty";
  if (MARKUP.test(t)) return "markup";
  if (EMAIL.test(t) || PHONE.test(t)) return "contact";
  if (LINK.test(t)) return "link";
  if (MONEY.test(t)) return "money";
  const folded = foldUgc(t);
  if (ABUSE.test(folded) || ABUSE.test(folded.replace(/[^\p{L}\s]/gu, ""))) return "abuse";
  return null;
}

/** The message for a problem (EN/FR, tutoiement). */
export function ugcProblemText(p: UgcProblem, lang: "en" | "fr"): string {
  const fr = lang === "fr";
  switch (p) {
    case "empty":
      return fr ? "Donne-lui un nom." : "Give it a name.";
    case "markup":
      return fr ? "Pas de symboles comme < > { } [ ]." : "No symbols like < > { } [ ].";
    case "link":
      return fr ? "Pas de liens : on partage avec le lien VVake." : "No links: sharing uses the VVake link.";
    case "contact":
      return fr ? "Pas d’e-mail ni de numéro de téléphone : c’est public." : "No e-mail or phone number: this is public.";
    case "money":
      return fr ? "Pas d’argent, de jetons ni de récompenses dans le texte." : "No money, tokens or rewards in the text.";
    case "abuse":
      return fr
        ? "Ce mot n’est pas accepté. Reste sympa : tout le monde peut le voir."
        : "That word isn’t allowed. Keep it friendly: everyone can see it.";
  }
}

/** Why someone reports a training, a move or a profile. */
export const REPORT_REASONS = ["offensive", "unsafe", "spam", "impersonation", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_TEXT: Readonly<Record<ReportReason, { en: string; fr: string }>> = {
  offensive: { en: "Offensive or hateful", fr: "Offensant ou haineux" },
  unsafe: { en: "Unsafe exercise", fr: "Exercice dangereux" },
  spam: { en: "Spam or advertising", fr: "Spam ou publicité" },
  impersonation: { en: "Pretends to be someone else", fr: "Se fait passer pour quelqu’un d’autre" },
  copyright: { en: "Copied from someone else", fr: "Copié sur quelqu’un d’autre" },
  other: { en: "Something else", fr: "Autre chose" },
};
/** Content hidden from discovery once this many distinct accounts reported it, until an admin looks. */
export const REPORT_HIDE_AT = 3;
