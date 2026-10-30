import * as z from "zod/mini";
import type { RewardsSession } from "@/lib/rewardsApi";
import { MEMORY_KINDS, type CoachMemoryItem, type MemoryKind, type MemorySource } from "./coachMemory";
import { CORRECTION_METRICS, type CorrectionMetric } from "./coachActions";
import type { DataCorrection } from "./dataCorrections";

/**
 * The super coach's endpoints on the web (VVFit ADR-0068, build 60; the API's super-coach-api branch): the account's
 * live talk status (GET /v1/coach/live `talk`), the coach's memory v2 (GET / POST / PATCH / DELETE /v1/coach/memory),
 * Health corrections (GET / POST / DELETE /v1/me/corrections). Parsed leniently like the rest of the web app: an older
 * API (no `talk`, memory lines without a kind) reads as "push-to-talk" and "preference", never a broken screen.
 */

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const opt = <T extends z.ZodMiniType>(t: T) => z.optional(z.catch(z.nullable(t), null));

// ── Live talk status ───────────────────────────────────────────────────────────────────────────────────────────

const talkSchema = z.object({
  live: opt(z.boolean()),
  leftS: opt(z.number()),
  why: opt(z.string()),
  weekS: opt(z.number()),
  packS: opt(z.number()),
});
const liveStatusSchema = z.looseObject({ talk: opt(talkSchema), remainingS: opt(z.number()) });

/** What the server says about live talk for this account; `live: false` when it says nothing (an older API). */
export interface TalkStatus {
  live: boolean;
  leftS?: number;
  why?: "free" | "off" | "no_minutes" | "tester_only";
}

const WHY = new Set(["free", "off", "no_minutes", "tester_only"]);

/** GET /v1/coach/live's `talk`, or "not live" from anything else. Pure. */
export function talkStatusOf(raw: z.infer<typeof liveStatusSchema> | null | undefined): TalkStatus {
  const t = raw?.talk;
  if (!t) return { live: false, why: "off" };
  const why = typeof t.why === "string" && WHY.has(t.why) ? (t.why as TalkStatus["why"]) : undefined;
  return {
    live: t.live === true,
    ...(typeof t.leftS === "number" && Number.isFinite(t.leftS) ? { leftS: Math.max(0, Math.round(t.leftS)) } : {}),
    ...(why ? { why } : {}),
  };
}

// ── Memory v2 ──────────────────────────────────────────────────────────────────────────────────────────────────

const memoryRow = z.object({
  id: z.string(),
  text: z.string(),
  kind: opt(z.string()),
  on: opt(z.string()),
  active: opt(z.boolean()),
  source: opt(z.string()),
  createdAt: opt(z.string()),
  updatedAt: opt(z.string()),
});
const memorySchema = z.object({ items: z.catch(z.array(z.catch(z.nullable(memoryRow), null)), []) });

const SOURCES: readonly MemorySource[] = ["said", "agreed", "extracted", "app", "edited"];

/** The API's lines as game-core items: an unknown kind (v1 lines) is a preference. Pure. */
export function memoryItemsOf(rows: readonly (z.infer<typeof memoryRow> | null)[]): CoachMemoryItem[] {
  const out: CoachMemoryItem[] = [];
  for (const r of rows) {
    if (!r || !r.text.trim()) continue;
    const kind = (MEMORY_KINDS as readonly string[]).includes(r.kind ?? "") ? (r.kind as MemoryKind) : "preference";
    const source = (SOURCES as readonly string[]).includes(r.source ?? "") ? (r.source as MemorySource) : "said";
    out.push({
      id: r.id,
      kind,
      text: r.text,
      ...(r.on && /^\d{4}-\d{2}-\d{2}$/.test(r.on) ? { on: r.on } : {}),
      ...(typeof r.active === "boolean" ? { active: r.active } : {}),
      source,
      createdAt: r.createdAt ?? "",
      ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
    });
  }
  return out;
}

/** The lines grouped by kind in game-core's order (style, injury, goal…), empty kinds left out. Pure. */
export function memoryGroups(items: readonly CoachMemoryItem[]): { kind: MemoryKind; items: CoachMemoryItem[] }[] {
  const order: MemoryKind[] = ["style", "injury", "goal", "life_event", "preference", "fact", "worked", "didnt_work", "win"];
  const known = new Set<MemoryKind>(order);
  for (const k of MEMORY_KINDS) if (!known.has(k)) order.push(k);
  return order.map((kind) => ({ kind, items: items.filter((m) => m.kind === kind) })).filter((g) => g.items.length > 0);
}

export interface MemoryEdit {
  kind?: MemoryKind;
  text?: string;
  on?: string | null;
  active?: boolean;
}

// ── Corrections ────────────────────────────────────────────────────────────────────────────────────────────────

const correctionRow = z.object({
  metric: z.string(),
  day: z.string(),
  value: z.number(),
  shown: opt(z.number()),
  at: opt(z.string()),
  source: opt(z.string()),
});
const correctionsSchema = z.looseObject({
  corrections: opt(z.array(z.catch(z.nullable(correctionRow), null))),
  items: opt(z.array(z.catch(z.nullable(correctionRow), null))),
});

/** The API's corrections (either list name), newest day first, unknown metrics left out. Pure. */
export function correctionsOf(raw: z.infer<typeof correctionsSchema> | null | undefined): DataCorrection[] {
  const rows = raw?.corrections ?? raw?.items ?? [];
  const out: DataCorrection[] = [];
  for (const r of rows) {
    if (!r || !(CORRECTION_METRICS as readonly string[]).includes(r.metric) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) continue;
    out.push({
      metric: r.metric as CorrectionMetric,
      day: r.day,
      value: r.value,
      ...(typeof r.shown === "number" ? { shown: r.shown } : {}),
      at: r.at ?? "",
      source: r.source === "chat" || r.source === "tap" ? r.source : "voice",
    });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));
}

export function talkApi(s: RewardsSession) {
  return {
    /** GET /v1/coach/live: this account's live talk now (Plus / Premium, server switch, minutes left). */
    talkStatus: async (lang: string): Promise<TalkStatus> =>
      talkStatusOf(await s.call(`/v1/coach/live?lang=${lang === "fr" ? "fr" : "en"}`, GET, liveStatusSchema)),
    memory: async () => memoryItemsOf((await s.call("/v1/coach/memory", GET, memorySchema)).items),
    addMemory: (b: { kind: MemoryKind; text: string; on?: string }) => s.call("/v1/coach/memory", send("POST", b), null),
    editMemory: (id: string, b: MemoryEdit) => s.call(`/v1/coach/memory/${encodeURIComponent(id)}`, send("PATCH", b), null),
    forget: (id: string) => s.call(`/v1/coach/memory/${encodeURIComponent(id)}`, send("DELETE"), null),
    forgetAll: () => s.call("/v1/coach/memory", send("DELETE"), null),
    corrections: async () => correctionsOf(await s.call("/v1/me/corrections", GET, correctionsSchema)),
    addCorrection: (b: { metric: CorrectionMetric; day: string; value: number; shown?: number; source: "voice" | "chat" | "tap" }) =>
      s.call("/v1/me/corrections", send("POST", b), null),
    /** Undo: the correction of that metric and day goes (Health's own value shows again). */
    undoCorrection: (metric: CorrectionMetric, day: string) =>
      s.call(`/v1/me/corrections?${new URLSearchParams({ metric, day })}`, send("DELETE"), null),
  };
}
export type TalkApi = ReturnType<typeof talkApi>;
