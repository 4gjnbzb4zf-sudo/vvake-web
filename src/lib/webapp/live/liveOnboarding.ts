/**
 * The day-one live call on the web (monorepo living-app.md §14, live-call.md §8): what its tools do to the "Your VVake"
 * cards. Pure (liveOnboarding.test.ts). A copy of the phone's apps/mobile lib/liveOnboarding.ts: the call fills the same
 * answers the cards hold, and Start on the same summary saves them the same way.
 */
import { cleanAnswers, type TailorAnswers, type TailorStep } from "@/lib/webapp/tailor/tailor";

const FIELDS = [
  "goals",
  "sports",
  "where",
  "event",
  "eventType",
  "eventDate",
  "challenge",
  "coaching",
  "voice",
  "style",
  "habits",
  "music",
  "notifications",
] as const;
type Field = (typeof FIELDS)[number];
const isField = (x: unknown): x is Field => typeof x === "string" && (FIELDS as readonly string[]).includes(x);

/** The card a field lives on. Pure. */
export function stepForField(id: unknown): TailorStep | null {
  if (!isField(id)) return null;
  if (id === "eventType" || id === "eventDate") return "eventDetails";
  if (id === "style") return "voice";
  return id as TailorStep;
}

/**
 * The call's answers over the cards' (the server sends the field it set and all its answers so far): only the
 * survey's own fields, cleaned by the survey's own rules (an invalid value keeps the card's). Pure.
 */
export function mergeCallAnswers(current: TailorAnswers, args: { id?: unknown; value?: unknown; answers?: unknown }): TailorAnswers {
  const patch: Record<string, unknown> = {};
  const from = args.answers && typeof args.answers === "object" ? (args.answers as Record<string, unknown>) : {};
  for (const k of FIELDS) if (from[k] !== undefined && from[k] !== null) patch[k] = from[k];
  if (isField(args.id) && args.value !== undefined && args.value !== null) patch[args.id] = args.value;
  const next = { ...current, ...patch } as Record<string, unknown>;
  // A few sports said at once: the card's "a few" mode (one sport keeps the card's choice).
  if (Array.isArray(patch.sports)) next.sportMode = (patch.sports as unknown[]).length > 1 ? "few" : current.sportMode;
  // The server checked each value against the same lists; the survey's own cleaning is the last word.
  return cleanAnswers(next);
}

/**
 * What the web answers when the coach asks for a permission (show_permission): Health lives in the phone apps (the
 * coach then asks roughly how much you move); the browser's own permissions aren't needed to set VVake up. Pure.
 */
export function webPermissionAnswer(kind: unknown): { status: "unavailable"; where: "phone_app" | "browser" } {
  return { status: "unavailable", where: kind === "health" ? "phone_app" : "browser" };
}
