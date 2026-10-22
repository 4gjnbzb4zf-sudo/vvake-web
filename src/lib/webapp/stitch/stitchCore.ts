// Copied from VVFit packages/game-core/src/stitchCore.ts (e1b98fbe 2026-10-22) by scripts/sync-stitch-core.ts. Do not edit: re-sync.
/**
 * The stitcher's core (ADR-0054), with no catalog and no manifest: a line's words → the clip ids to play, from the
 * vocabulary tables a pack carries (`StitchTables`: phrase keys → clip ids, unit words, abbreviations, French feminine
 * nouns) and the number rules below. game-core's `stitch` (stitchVoice.ts) calls it with the manifest's own tables;
 * the apps call it with the downloaded pack's tables (`pack.header.tables`), so a line only asks for clips that pack
 * has. vvake-web copies this file as is (its parity test checks the golden cases); the watches port it (Swift, Kotlin).
 */

export type StitchLang = "en" | "fr";

/** The vocabulary of a pack (stitchVoice.ts `stitchTables`). */
export interface StitchTables {
  /** Phrase key (tokens joined by spaces, "." and "," for pauses) → clip id. */
  phrases: Record<string, string>;
  /** Longest phrase key, in tokens. */
  maxLen: number;
  /** Abbreviation after a number → unit key ("km" → "km", "mins" → "min"). */
  abbr: Record<string, string>;
  /** Pace abbreviations ("/km", "min/km") → unit key ("/km"). */
  per: Record<string, string>;
  /** Unit key → its words, singular and plural ("km" → ["kilometre", "kilometres"]; "/km" → ["per kilometre", …]). */
  units: Record<string, [string, string]>;
  /** French nouns that make the number before them feminine. */
  fem: string[];
}

/** The numbers whose French feminine differs ("une", "vingt et une", …, "quatre-vingt-une"). */
export const FR_FEMININE = [1, 21, 31, 41, 51, 61, 81] as const;

/** Spellings said like the coach's words (US spellings). */
const ALIASES: Record<string, string> = {
  kilometer: "kilometre",
  kilometers: "kilometres",
  meter: "metre",
  meters: "metres",
  kilometre: "kilometre",
};

export type Tok =
  { t: "w"; w: string } | { t: "p"; p: "." | "," } | { t: "n"; int: number; dec?: string; raw: string } | { t: "time"; parts: number[] };

/** Lower case, one apostrophe, US spellings said like the coach's. */
export function normWord(w: string): string {
  const l = w.normalize("NFC").toLowerCase().replace(/[’‘`]/g, "'");
  return ALIASES[l] ?? l;
}

/**
 * A line's tokens: words, numbers (English "1,250" / "5.2", French "1 250" / "5,2"), times "5:32" / "1:05:32", unit
 * abbreviations ("/km", "km/h", "%"), and pauses ("." for . ! ? …, "," for , : ; and dashes). Quotes and brackets
 * are dropped; anything else is a word of its own (the vocabulary decides).
 */
export function tokenize(text: string, lang: StitchLang): Tok[] {
  const s = text.normalize("NFC").replace(/[   ]/g, " ");
  const out: Tok[] = [];
  const num = lang === "en" ? /^(\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.(\d+))?/ : /^(\d{1,3}(?: \d{3})+(?!\d)|\d+)(?:[,.](\d+))?/;
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    let m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)/.exec(rest);
    if (m) {
      out.push({ t: "time", parts: [m[1], m[2], m[3]].filter((x) => x !== undefined).map(Number) });
      i += m[0].length;
      continue;
    }
    m = /^(?:min)?\/(?:km|mi)\b/i.exec(rest) ?? /^km\/h\b/i.exec(rest);
    if (m) {
      out.push({ t: "w", w: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    m = num.exec(rest);
    if (m) {
      const int = Number(m[1]!.replace(/[ ,]/g, ""));
      out.push({ t: "n", int, ...(m[2] !== undefined ? { dec: m[2] } : {}), raw: m[0] });
      i += m[0].length;
      // "12-day": the hyphen joins the number to its word.
      if (s[i] === "-" && /\p{L}/u.test(s[i + 1] ?? "")) i++;
      continue;
    }
    if (/[.!?…]/.test(c)) {
      pushPause(out, ".");
      i++;
      continue;
    }
    if (/[,:;—–]/.test(c) || (c === "-" && /\s/.test(s[i - 1] ?? " ") && /\s/.test(s[i + 1] ?? " "))) {
      pushPause(out, ",");
      i++;
      continue;
    }
    if (/["“”«»()[\]*_]/.test(c)) {
      i++;
      continue;
    }
    if (c === "%") {
      out.push({ t: "w", w: "%" });
      i++;
      continue;
    }
    m = /^[\p{L}\p{M}][\p{L}\p{M}'’\-]*/u.exec(rest);
    if (m) {
      // A trailing hyphen or apostrophe is not part of the word.
      const w = m[0].replace(/[-'’]+$/, "");
      out.push({ t: "w", w: normWord(w) });
      i += w.length || 1;
      continue;
    }
    out.push({ t: "w", w: c });
    i++;
  }
  while (out.length && out[0]!.t === "p") out.shift();
  return out;
}
function pushPause(out: Tok[], p: "." | ",") {
  const last = out[out.length - 1];
  if (last?.t === "p") {
    if (p === ".") last.p = ".";
    return;
  }
  out.push({ t: "p", p });
}

export const keyOf = (toks: readonly Tok[]) => toks.map((x) => (x.t === "w" ? x.w : x.t === "p" ? x.p : "#")).join(" ");

/** Number clip ids (systematic: the watches build them the same way). */
export const numId = {
  /** 0–99; `f` sentence-final; `fem` French feminine. */
  n: (v: number, final: boolean, fem = false) => `n.${v}.${final ? "f" : "m"}${fem ? ".fem" : ""}`,
  /** "three hundred" / French exact hundreds "trois cents" (and "cent"). */
  h: (d: number, final: boolean) => `h.${d}.${final ? "f" : "m"}`,
  /** French hundreds followed by more: "trois cent" (2–9; 1 is `h.1.m` "cent"). */
  hx: (d: number) => `hx.${d}`,
  /** "thousand" / "mille". */
  k: (final: boolean) => `k.${final ? "f" : "m"}`,
  /** English "oh" in 5:05. */
  oh: "oh",
  /** "point" / "virgule". */
  pt: "pt",
  /** French hours with their liaison: "une heure", "deux heures" … "vingt-quatre heures". */
  hr: (v: number, final: boolean) => `hr.${v}.${final ? "f" : "m"}`,
  /** French "quatre-vingt" before "mille". */
  q80: "n.80x",
};
// ---- stitching --------------------------------------------------------------------------------------------------

/** The pieces of an integer 0–999,999, or null outside. `final` on the last piece; `fem` French feminine. */
export function numberIds(v: number, lang: StitchLang, final: boolean, fem = false): string[] | null {
  if (!Number.isInteger(v) || v < 0 || v > 999_999) return null;
  const fr = lang === "fr";
  const below1000 = (n: number, last: boolean, f: boolean, multiplier: boolean): string[] => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const out: string[] = [];
    if (h) {
      if (r === 0) {
        if (fr && multiplier && h > 1) return [numId.hx(h)];
        return [numId.h(h, last)];
      }
      out.push(fr ? (h === 1 ? numId.h(1, false) : numId.hx(h)) : numId.h(h, false));
    }
    if (fr && multiplier && r === 80) return [...out, numId.q80];
    out.push(numId.n(r, last, fr && f && (FR_FEMININE as readonly number[]).includes(r)));
    return out;
  };
  if (v < 1000) return below1000(v, final, fem, false);
  const th = Math.floor(v / 1000);
  const r = v % 1000;
  const out: string[] = [];
  if (!(fr && th === 1)) out.push(...below1000(th, false, false, true));
  out.push(numId.k(final && r === 0));
  if (r) out.push(...below1000(r, final, fem, false));
  return out;
}

/** What follows a token decides its prosody: the end of a sentence (or of the line) is final. */
const isFinal = (next: Tok | undefined) => !next || (next.t === "p" && next.p === ".");

/**
 * A line's clip ids (and "." / "," pauses) in `lang` from a pack's `tables`, or null when a piece has no clip: the
 * words as the screen shows them ("3 kilometres. Time 15:32. Keep moving.").
 */
export function stitchWith(text: string, lang: StitchLang, tables: StitchTables): string[] | null {
  if (!text) return null;
  const fr = lang === "fr";
  const femWords = new Set(tables.fem);
  const toks = expand(tokenize(text, lang), lang, tables);
  const out: string[] = [];
  const pause = (p: "." | ",") => {
    if (!out.length) return;
    const last = out[out.length - 1];
    if (last === "." || last === ",") {
      if (p === ".") out[out.length - 1] = ".";
    } else out.push(p);
  };
  for (let i = 0; i < toks.length;) {
    const t = toks[i]!;
    const next = toks[i + 1];
    const nextWord = next?.t === "w" ? next.w : undefined;
    const fem = fr && !!nextWord && femWords.has(nextWord);
    if (t.t === "p") {
      pause(t.p);
      i++;
      continue;
    }
    if (t.t === "n") {
      // French hours with their liaison, recorded whole: "deux heures".
      if (fr && !t.dec && t.int >= 1 && t.int <= 24 && (nextWord === "heure" || nextWord === "heures")) {
        out.push(numId.hr(t.int, isFinal(toks[i + 2])));
        i += 2;
        continue;
      }
      const ids = numberWithDecimals(t, lang, isFinal(next), fem);
      if (!ids) return null;
      out.push(...ids);
      i++;
      continue;
    }
    if (t.t === "time") {
      const ids = timeIds(t.parts, lang, isFinal(next), tables);
      if (!ids) return null;
      out.push(...ids);
      i++;
      continue;
    }
    // Words (and pauses inside a fragment): the longest phrase that starts here.
    let hit: { id: string; len: number; key: string } | null = null;
    for (let len = tables.maxLen; len >= 1 && !hit; len--) {
      const slice = toks.slice(i, i + len);
      if (slice.length < len || slice.some((x) => x.t === "n" || x.t === "time")) continue;
      const key = keyOf(slice);
      const id = Object.prototype.hasOwnProperty.call(tables.phrases, key) ? tables.phrases[key] : undefined;
      if (id) hit = { id, len, key };
    }
    if (!hit) return null;
    out.push(hit.id);
    i += hit.len;
    const end = hit.key.slice(-1);
    if (end === "." || end === ",") pause(end);
  }
  while (out.length && (out[out.length - 1] === "." || out[out.length - 1] === ",")) out.pop();
  return out.length ? out : null;
}

/** Unit abbreviations after a number become the unit's words (singular or plural by the number); "/km" its words. */
function expand(toks: Tok[], lang: StitchLang, tables: StitchTables): Tok[] {
  const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const prev = toks[i - 1];
    if (t.t === "w" && has(tables.per, t.w) && tables.units[tables.per[t.w]!]) {
      out.push(...tokenize(tables.units[tables.per[t.w]!]![0], lang));
      continue;
    }
    if (t.t === "w" && prev?.t === "n" && has(tables.abbr, t.w) && tables.units[tables.abbr[t.w]!]) {
      const [one, many] = tables.units[tables.abbr[t.w]!]!;
      const v = prev.int + (prev.dec ? Number(`0.${prev.dec}`) : 0);
      const single = lang === "fr" ? v < 2 : v === 1 && !prev.dec;
      out.push(...tokenize(single ? one : many, lang));
      continue;
    }
    out.push(t);
  }
  return out;
}

function numberWithDecimals(t: Extract<Tok, { t: "n" }>, lang: StitchLang, final: boolean, fem: boolean): string[] | null {
  if (!t.dec) return numberIds(t.int, lang, final, fem);
  if (t.dec.length > 2) return null;
  const head = numberIds(t.int, lang, false, fem);
  if (!head) return null;
  if (lang === "en") {
    const digits = [...t.dec].map((d, i, a) => numId.n(Number(d), final && i === a.length - 1));
    return [...head, numId.pt, ...digits];
  }
  // French reads the decimals as a number, a leading zero said: "cinq virgule zéro cinq".
  const tail =
    t.dec.length === 2 && t.dec[0] === "0" ? [numId.n(0, false), numId.n(Number(t.dec[1]), final)] : numberIds(Number(t.dec), lang, final);
  return tail ? [...head, numId.pt, ...tail] : null;
}

/**
 * A time or a pace: m:ss ("five thirty-two" / "cinq minutes trente-deux"; whole minutes "five minutes"; under a
 * minute "forty-five seconds") and h:mm:ss ("one hour five minutes thirty-two seconds").
 */
function timeIds(parts: number[], lang: StitchLang, final: boolean, tables: StitchTables): string[] | null {
  const fr = lang === "fr";
  const [a, b, c] = parts as [number, number, number?];
  if (b > 59 || (c !== undefined && c > 59)) return null;
  const unit = (one: string, many: string, v: number, fin: boolean) => unitWords(v === 1 || (fr && v < 2) ? one : many, lang, fin, tables);
  const words = (k: string) => {
    const [one, many] = tables.units[k] ?? ["", ""];
    return { one: { [lang]: one } as Record<StitchLang, string>, many: { [lang]: many } as Record<StitchLang, string> };
  };
  const minW = words("min");
  const secW = words("s");
  const hrW = words("h");
  const seq: (string[] | null)[] = [];
  if (c !== undefined) {
    // h:mm:ss, zero parts skipped.
    const h = a;
    const m = b;
    const s = c;
    const lastIs = s ? "s" : m ? "m" : "h";
    if (h) {
      if (fr && h <= 24) seq.push([numId.hr(h, final && lastIs === "h")]);
      else seq.push(numberIds(h, lang, false, fr), unit(hrW.one[lang], hrW.many[lang], h, final && lastIs === "h"));
    }
    if (m) seq.push(numberIds(m, lang, false, fr), unit(minW.one[lang], minW.many[lang], m, final && lastIs === "m"));
    if (s) seq.push(numberIds(s, lang, false, fr), unit(secW.one[lang], secW.many[lang], s, final && lastIs === "s"));
  } else {
    const m = a;
    const s = b;
    if (m === 0) seq.push(numberIds(s, lang, false, fr), unit(secW.one[lang], secW.many[lang], s, final));
    else if (s === 0) seq.push(numberIds(m, lang, false, fr), unit(minW.one[lang], minW.many[lang], m, final));
    else if (fr)
      seq.push(numberIds(m, lang, false, true), unit(minW.one[lang], minW.many[lang], m, false), numberIds(s, lang, final, true));
    else seq.push(numberIds(m, lang, false), s < 10 ? [numId.oh, numId.n(s, final)] : numberIds(s, lang, final));
  }
  if (seq.some((x) => !x)) return null;
  return seq.flat() as string[];
}

/** A unit's clip (from the phrase table) by its words, its final take at the end of a sentence. */
function unitWords(w: string, lang: StitchLang, final: boolean, tables: StitchTables): string[] | null {
  if (!w) return null;
  const key = keyOf(tokenize(w, lang));
  const id = (final ? tables.phrases[`${key} .`] : undefined) ?? tables.phrases[key];
  return id ? [id] : null;
}
