/**
 * Nutrition on the web (VVFit ADR-0070): the small pure helpers the screens share, beside game-core's rules (./core).
 * Hiding numbers, a portion as a multiple, the week's Monday, the grocery list as text, the shopping slot as an .ics,
 * the slots this browser remembers. Pure but where it says.
 */
import { icsEscape, icsFold } from "../living/icsCore";
import type { GroceryAisle } from "./nutritionApi";

/** The profile fields that decide whether numbers show. */
export interface NumbersInput {
  hideNumbers: boolean;
  flagged: boolean;
  adult: boolean | null;
}

/**
 * Numbers hidden: the athlete's choice, calm mode (flagged, always hidden), or not known to be an adult (under 18 or
 * not answered yet: hidden by default, ADR-0070 rule 3). Pure.
 */
export const numbersHidden = (p: NumbersInput) => p.hideNumbers || p.flagged || p.adult !== true;

/** May the athlete show numbers with one tap (not in calm mode, not under 18 / unanswered)? Pure. */
export const canShowNumbers = (p: NumbersInput) => !p.flagged && p.adult === true;

/** The portion slider's steps: 0.25× to 3× the first estimate. */
export const PORTION_MIN = 0.25;
export const PORTION_MAX = 3;
export const PORTION_STEP = 0.25;

/** Grams for a multiple of the original grams, rounded, 1–2000 (game-core's clamp). Pure. */
export const gramsAt = (baseGrams: number, factor: number) =>
  Math.max(1, Math.min(2000, Math.round(baseGrams * Math.max(PORTION_MIN, Math.min(PORTION_MAX, factor)))));

/** `YYYY-MM-DD` of the Monday of the week holding `day` (`YYYY-MM-DD`), weeks starting Monday like the plan. Pure. */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` plus `n` days. Pure. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** A local day's start and end in ms (this browser's zone). */
export function dayBounds(day: string): { from: number; to: number } {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { from: new Date(y, m - 1, d).getTime(), to: new Date(y, m - 1, d + 1).getTime() - 1 };
}

/** A grocery row's quantity as one short label ("500 g", "2", "1 l"). Pure. */
export const qtyLabel = (i: { qty: string; unit?: string }) =>
  [i.qty, i.unit]
    .filter((x) => x && String(x).trim())
    .join(" ")
    .trim();

/** The list as plain text to copy or share: aisles as headings, what's still needed only (ticked items left out). Pure. */
export function groceryText(
  aisles: readonly GroceryAisle[],
  have: ReadonlySet<string>,
  names: { title: string; aisle: (k: string) => string },
): string {
  const out: string[] = [names.title];
  for (const a of aisles) {
    const need = a.items.filter((i) => !have.has(i.name.toLowerCase()));
    if (!need.length) continue;
    out.push("", names.aisle(a.aisle));
    for (const i of need) out.push(`- ${i.name}${qtyLabel(i) ? ` (${qtyLabel(i)})` : ""}`);
  }
  return out.join("\n");
}

/** The ticked set to start from: the server's `have` and this week's ticks. Pure. */
export function initialHave(aisles: readonly GroceryAisle[]): Set<string> {
  const s = new Set<string>();
  for (const a of aisles) for (const i of a.items) if (i.have) s.add(i.name.toLowerCase());
  return s;
}

const icsUtc = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/**
 * The shopping slot as an .ics (one VEVENT in UTC, a 30-minute alarm, the list in the notes, nothing else personal), or
 * `past` when it starts before now. The web's add_to_calendar path (webActions.actionIcs) for groceries. Pure.
 */
export function groceryIcs(
  slot: { start: number; durationMin: number },
  o: { summary: string; note: string; list: string; nowMs: number; uid: string },
): { ics: string; file: string } | { fail: "past" } {
  if (!Number.isFinite(slot.start) || slot.start < o.nowMs) return { fail: "past" };
  const desc = `${o.note}\n${o.list}`.slice(0, 3000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VVake//Nutrition 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:groceries-${o.uid}@vvake.com`,
    `DTSTAMP:${icsUtc(o.nowMs)}`,
    `DTSTART:${icsUtc(slot.start)}`,
    `DTEND:${icsUtc(slot.start + Math.max(15, Math.min(240, slot.durationMin)) * 60_000)}`,
    `SUMMARY:${icsEscape(o.summary)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT30M",
    `DESCRIPTION:${icsEscape(o.summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const d = new Date(slot.start);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { ics: lines.map(icsFold).join("\r\n") + "\r\n", file: `vvake-groceries-${day}.ics` };
}

// ── This browser's confirmed shopping slots (bestShopSlot's pastShops: it learns when you shop) ───────────────────

const SHOPS_KEY = "vvake-nutrition-shops";
export type PastShop = { dow: number; hour: number };

/** Read the remembered slots (at most 12, newest last); empty when storage is off. */
export function readPastShops(): PastShop[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHOPS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (x): x is PastShop =>
          !!x &&
          typeof x === "object" &&
          Number.isInteger((x as PastShop).dow) &&
          Number.isInteger((x as PastShop).hour) &&
          (x as PastShop).dow >= 0 &&
          (x as PastShop).dow <= 6 &&
          (x as PastShop).hour >= 0 &&
          (x as PastShop).hour <= 23,
      )
      .slice(-12);
  } catch {
    return [];
  }
}

/** Remember a confirmed slot (its local weekday and hour). */
export function rememberShop(startMs: number) {
  const d = new Date(startMs);
  const next = [...readPastShops(), { dow: d.getDay(), hour: d.getHours() }].slice(-12);
  try {
    localStorage.setItem(SHOPS_KEY, JSON.stringify(next));
  } catch {
    // private mode: not learned this time
  }
}

/** `YYYY-MM-DDTHH:MM` for a datetime-local input, in this browser's zone. */
export function localInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A free-text constraint (an allergy, a dislike) as the profile keeps it: trimmed, lower-case, ≤ 40 chars. Pure. */
export const cleanTerm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);

/** Add a term to a list once (≤ max entries). Pure. */
export function addTerm(list: readonly string[], term: string, max = 20): string[] {
  const t = cleanTerm(term);
  if (!t || list.includes(t) || list.length >= max) return [...list];
  return [...list, t];
}
