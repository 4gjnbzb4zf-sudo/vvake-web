// Mirrors packages/game-core/src/vvakerRequest.ts (keep in sync; same test vectors in vvakerCheck.test.ts).
/**
 * VVaker generation: is this request complete and valid? The apps, this site and the API's render route use the same
 * rules. A render is a paid image (about $0.04): an invalid request is stopped before anything is spent, and the form
 * shows which field to fix (it scrolls there, focuses it and says why under it).
 *
 * The first issue is returned, in the order the fields appear on screen (the name, then the code).
 */
import type { Locale } from "@/i18n/config";
import { personaFromCode } from "./personaPrompt";
import { VVAKER_SPORTS } from "@/components/vvaker/traits";

export type VVakerField = "name" | "code";
export type VVakerIssueKey = "nameMissing" | "nameTooLong" | "nameInvalid" | "codeMissing" | "codeInvalid";
export interface VVakerIssue {
  field: VVakerField;
  key: VVakerIssueKey;
}

/** The longest VVaker name (the inputs cap it here too). */
export const VVAKER_NAME_MAX = 24;

const nameLength = (s: string) => [...s].length;

/** The first reason this VVaker request can't be rendered, or null when it can (see game-core vvakerRequestIssues). */
export function vvakerRequestIssues(
  req: { name?: string | null; code?: string | null },
  o: { requireName?: boolean } = {},
): VVakerIssue | null {
  const requireName = o.requireName ?? true;
  if (req.name !== undefined || requireName) {
    const name = (req.name ?? "").trim();
    if (!name) return { field: "name", key: "nameMissing" };
    if (nameLength(name) > VVAKER_NAME_MAX) return { field: "name", key: "nameTooLong" };
    if (/\p{Cc}/u.test(name)) return { field: "name", key: "nameInvalid" };
  }
  const code = (req.code ?? "").trim();
  if (!code) return { field: "code", key: "codeMissing" };
  if (!personaFromCode(code, VVAKER_SPORTS)) return { field: "code", key: "codeInvalid" };
  return null;
}

const TEXT: Record<Locale, Record<VVakerIssueKey, string>> = {
  en: {
    nameMissing: "Give your VVaker a name",
    nameTooLong: `Keep the name to ${VVAKER_NAME_MAX} characters`,
    nameInvalid: "Use letters, numbers or emoji in the name",
    codeMissing: "Enter your VVaker code",
    codeInvalid: "That code doesn't look right: check it on the site.",
  },
  fr: {
    nameMissing: "Donne un nom à ton VVaker",
    nameTooLong: `${VVAKER_NAME_MAX} caractères maximum pour le nom`,
    nameInvalid: "Utilise des lettres, des chiffres ou des emoji dans le nom",
    codeMissing: "Entre le code de ton VVaker",
    codeInvalid: "Ce code semble incorrect : vérifie-le sur le site.",
  },
};

/** The short line shown under the field (EN, or FR with "tu"). */
export function vvakerIssueText(issue: VVakerIssue | VVakerIssueKey, lang: Locale | string = "en"): string {
  const key = typeof issue === "string" ? issue : issue.key;
  return (lang === "fr" ? TEXT.fr : TEXT.en)[key];
}
