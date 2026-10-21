import type { RewardsSession } from "@/lib/rewardsApi";
import type { CustomMove } from "@/lib/webapp/camera/cameraCustom";
import type { MoveTemplate } from "@/lib/webapp/camera/cameraTemplate";
import type { Training } from "@/lib/webapp/camera/cameraTraining";
import type { ReportReason } from "@/lib/webapp/camera/ugc";
import {
  readBoard,
  readCreatorPage,
  readCreatorStats,
  readDiscover,
  readMyTrainings,
  readProfile,
  readRun,
  readShared,
  readTraining,
  type MyProfile,
} from "./data";

/**
 * The custom trainings API (docs/05-tech/custom-trainings.md): the public routes the share and creator pages call
 * without an account, and the signed-in ones the web app calls on its session (RewardsSession, the same 401 refresh
 * as every other call). Every reply goes through the lenient readers of data.ts.
 */

export type PublicResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** A public GET (no account): the JSON, or the status (0 offline or timed out, 404 private, hidden or gone). */
export async function publicGet(apiUrl: string, path: string, timeoutMs = 6000): Promise<PublicResult<unknown>> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}${path}`, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(id);
  }
}

const enc = encodeURIComponent;

export const publicTrainings = (apiUrl: string) => ({
  shared: async (code: string) => {
    const r = await publicGet(apiUrl, `/v1/t/${enc(code)}`);
    return r.ok ? (readShared(r.data, code) ?? { status: 422 as const }) : { status: r.status };
  },
  board: async (challenge: string) => {
    const r = await publicGet(apiUrl, `/v1/training-challenges/${enc(challenge)}`);
    return r.ok ? readBoard(r.data) : null;
  },
  creator: async (handle: string) => {
    const r = await publicGet(apiUrl, `/v1/creators/${enc(handle)}`);
    return r.ok ? (readCreatorPage(r.data) ?? { status: 422 as const }) : { status: r.status };
  },
});

export interface NewMove {
  name: string;
  icon: string;
  kind: "reps" | "hold";
  family?: CustomMove["family"];
  weighted?: boolean;
  template: MoveTemplate;
  checked: boolean;
}

export type TrainingBody = Omit<Training, "id" | "v" | "creator">;

export interface DiscoverQuery {
  q?: string;
  sport?: string;
  level?: string;
  city?: string;
  sort?: "popular" | "new" | "coach";
  cursor?: string;
}

/** `?a=1&b=x`, empty values left out. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${enc(k)}=${enc(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

const GET: RequestInit = { method: "GET" };
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function trainingsApi(s: RewardsSession) {
  const call = (path: string, init: RequestInit) => s.call<unknown>(path, init, null);
  return {
    myMoves: async () => {
      const j = (await call("/v1/moves", GET)) as { moves?: unknown } | null;
      return Array.isArray(j?.moves) ? (j.moves as unknown[]) : [];
    },
    createMove: async (m: NewMove) => ((await call("/v1/moves", send("POST", m))) as { move?: unknown } | null)?.move ?? null,
    deleteMove: (id: string) => call(`/v1/moves/${enc(id)}`, send("DELETE")),

    trainings: async () => readMyTrainings(await call("/v1/trainings", GET)),
    training: async (id: string) => readTraining(await call(`/v1/trainings/${enc(id)}`, GET)),
    /** The signed-in view: the training, whose it is (the creator's id, for blocking), and whether it's mine. */
    trainingFull: async (id: string, myId: string) => {
      const j = (await call(`/v1/trainings/${enc(id)}`, GET)) as { creator?: { id?: unknown }; userId?: unknown; mine?: unknown } | null;
      const creatorId = typeof j?.creator?.id === "string" ? j.creator.id : typeof j?.userId === "string" ? j.userId : null;
      return { parsed: readTraining(j), creatorId, mine: j?.mine === true || (!!creatorId && creatorId === myId) };
    },
    createTraining: async (b: TrainingBody) => {
      const j = (await call("/v1/trainings", send("POST", b))) as { training?: unknown; code?: unknown; url?: unknown } | null;
      return {
        code: typeof j?.code === "string" ? j.code : null,
        url: typeof j?.url === "string" ? j.url : null,
        raw: j?.training ?? null,
      };
    },
    updateTraining: (id: string, b: Partial<TrainingBody>) => call(`/v1/trainings/${enc(id)}`, send("PATCH", b)),
    deleteTraining: (id: string) => call(`/v1/trainings/${enc(id)}`, send("DELETE")),
    join: (id: string, days?: number[]) => call(`/v1/trainings/${enc(id)}/join`, send("POST", days && days.length ? { days } : {})),
    leave: (id: string) => call(`/v1/trainings/${enc(id)}/join`, send("DELETE")),
    /** After the session upload (web runs are scored, never qualifying for creator rewards: ADR-0043, ADR-0047). */
    recordRun: async (id: string, b: { sessionId: string; challengeCode?: string | null }) =>
      readRun(
        await call(
          `/v1/trainings/${enc(id)}/runs`,
          send("POST", b.challengeCode ? { sessionId: b.sessionId, challengeCode: b.challengeCode } : { sessionId: b.sessionId }),
        ),
      ),
    challenge: async (id: string, windowHours: 24 | 72 | 168, showName: boolean) => {
      const j = (await call(`/v1/trainings/${enc(id)}/challenges`, send("POST", { windowHours, showName }))) as {
        code?: unknown;
        url?: unknown;
        endsAt?: unknown;
      } | null;
      return { code: typeof j?.code === "string" ? j.code : null, url: typeof j?.url === "string" ? j.url : null };
    },
    joinChallenge: (code: string, showName: boolean) => call(`/v1/training-challenges/${enc(code)}/join`, send("POST", { showName })),

    discover: async (p: DiscoverQuery = {}) => readDiscover(await call(`/v1/discover${query({ ...p })}`, GET)),
    follow: (handle: string) => call(`/v1/creators/${enc(handle)}/follow`, send("POST")),
    unfollow: (handle: string) => call(`/v1/creators/${enc(handle)}/follow`, send("DELETE")),
    creator: async (handle: string) => readCreatorPage(await call(`/v1/creators/${enc(handle)}`, GET)),
    myProfile: async () => readProfile(await call("/v1/me/profile", GET)),
    /** 409: the handle is taken; 422 ugc: the bio didn't pass the filter. */
    updateProfile: async (p: Partial<MyProfile>) => readProfile(await call("/v1/me/profile", send("PATCH", p))),
    creatorStats: async () => readCreatorStats(await call("/v1/me/creator", GET)),

    report: (kind: "training" | "move" | "profile", id: string, reason: ReportReason, note?: string) =>
      call("/v1/reports", send("POST", note ? { kind, id, reason, note } : { kind, id, reason })),
    block: (userId: string) => call(`/v1/users/${enc(userId)}/block`, send("POST")),
  };
}
export type TrainingsApi = ReturnType<typeof trainingsApi>;
