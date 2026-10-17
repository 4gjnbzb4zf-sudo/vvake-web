/**
 * What the web app keeps in this browser (vvake.com/app), in IndexedDB: the workout under way (so a reload or a
 * closed tab resumes it) and the finished sessions waiting to upload (sent when back online and signed in to the same
 * account). Every call is wrapped: private windows, blocked storage or an old browser fall back to memory for this
 * visit, and the page still works (the banner then says a reload would lose the workout).
 */

const DB = "vvake-app";
const STORE = "kv";

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** False when nothing outlives this page (memory only). */
  readonly durable: boolean;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    durable: false,
    get: async <T>(k: string) => (m.has(k) ? (structuredClone(m.get(k)) as T) : undefined),
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
  };
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function openDb(): Promise<IDBDatabase> {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => {
    if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
  };
  return req(r);
}

/** IndexedDB when it works, memory otherwise (decided once, on first use). */
export async function openKV(): Promise<KV> {
  try {
    if (typeof indexedDB === "undefined") return memoryKV();
    const db = await openDb();
    const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
    // A write that fails (quota, Safari's private mode) is not fatal: the value stays in memory for this visit.
    const fallback = memoryKV();
    return {
      durable: true,
      get: async <T>(k: string) => {
        try {
          return (await req(tx("readonly").get(k))) as T | undefined;
        } catch {
          return fallback.get<T>(k);
        }
      },
      set: async (k, v) => {
        try {
          await req(tx("readwrite").put(v, k));
        } catch {
          await fallback.set(k, v);
        }
      },
      del: async (k) => {
        try {
          await req(tx("readwrite").delete(k));
        } catch {
          await fallback.del(k);
        }
      },
    };
  } catch {
    return memoryKV();
  }
}

export const WORKOUT_KEY = "workout";
export const QUEUE_KEY = "uploads";

/** A finished session waiting to upload, for one account. */
export interface Queued<S> {
  userId: string;
  session: S;
  /** Upload attempts (the API refused it as invalid after this many: dropped from the queue, kept nowhere). */
  tries: number;
}

/** Adds a session (once per id) to the queue. */
export function enqueue<S extends { id: string }>(q: readonly Queued<S>[], userId: string, session: S): Queued<S>[] {
  return [...q.filter((x) => x.session.id !== session.id), { userId, session, tries: 0 }];
}

/** What the API said per id: created, exists and deleted leave the queue; invalid leaves after 3 tries. */
export function afterUpload<S extends { id: string }>(
  q: readonly Queued<S>[],
  results: readonly { id: string; status: string }[],
): Queued<S>[] {
  const by = new Map(results.map((r) => [r.id, r.status]));
  return q
    .map((x) => (by.get(x.session.id) === "invalid" ? { ...x, tries: x.tries + 1 } : x))
    .filter((x) => {
      const st = by.get(x.session.id);
      if (st === "created" || st === "exists" || st === "deleted") return false;
      return x.tries < 3;
    });
}
