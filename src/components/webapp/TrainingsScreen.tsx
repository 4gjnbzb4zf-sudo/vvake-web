"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getTrainingsDict, type TrainingsDict } from "@/i18n/trainings";
import { ApiError } from "@/lib/rewardsApi";
import { cn } from "@/lib/cn";
import { publicTrainings, trainingsApi, type TrainingsApi } from "@/lib/trainings/api";
import {
  builderMoves,
  canAddSet,
  checkDraft,
  draftBody,
  draftOf,
  emptyDraft,
  ICON_GLYPH,
  kindOf,
  moveSet,
  newSet,
  type Draft,
  type DraftSet,
} from "@/lib/trainings/builder";
import { type CreatorCard, type CreatorStats, type MyProfile, type SharedTraining, type TrainingCard } from "@/lib/trainings/data";
import { CREATOR_HANDLE, trainingShareUrl } from "@/lib/trainings/link";
import { cleanCustomMove, type CustomMove } from "@/lib/webapp/camera/cameraCustom";
import {
  trainingMinutes,
  trainingSets,
  TRAINING_LEVELS,
  type Training,
  type TrainingLevel,
  type TrainingVisibility,
} from "@/lib/webapp/camera/cameraTraining";
import { REPORT_REASON_TEXT, REPORT_REASONS, type ReportReason } from "@/lib/webapp/camera/ugc";
import { TrainingCardRow, TrainingView } from "@/components/trainings/TrainingView";
import { useApp } from "./AppContext";
import { Btn, Card, Field, H1, inputCls, Kicker, List, Note, Row, Segmented, Small, Toggle } from "./ui";

/**
 * Custom trainings in the web app (monorepo ADR-0047; the phone's Trainings screens): Discover (search
 * GET /v1/discover), my trainings and the ones I joined, a training's page (run it with the webcam, join, share,
 * challenge friends, report, block), the builder (checked by game-core cleanTraining before it's sent), my taught
 * moves, and my opt-in coach profile with my creator points. Teaching a move uses the webcam: CameraScreen's teach mode.
 */

export function useTrainings(): { api: TrainingsApi; d: TrainingsDict } {
  const { session, lang } = useApp();
  return { api: useMemo(() => trainingsApi(session), [session]), d: getTrainingsDict(lang) };
}

/** My taught moves (GET /v1/moves), cleaned by game-core. */
export function useMyMoves(api: TrainingsApi) {
  const [moves, setMoves] = useState<CustomMove[] | null>(null);
  const load = useCallback(
    () =>
      api
        .myMoves()
        .then((list) => setMoves(list.map(cleanCustomMove).filter((m): m is CustomMove => !!m)))
        .catch(() => setMoves([])),
    [api],
  );
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  return { moves, reload: load };
}

const errorText = (e: unknown, d: TrainingsDict["app"]["builder"]) =>
  e instanceof ApiError ? (e.code === "ugc" || e.status === 422 ? d.ugc : e.status === 429 ? d.limit : d.error) : d.error;

// ── The tab ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function TrainingsScreen() {
  const { lang, go } = useApp();
  const { api, d } = useTrainings();
  const a = d.app;
  const [tab, setTab] = useState<"discover" | "mine" | "joined">("discover");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<TrainingLevel | "">("");
  const [sort, setSort] = useState<"popular" | "new" | "coach">("popular");
  const [found, setFound] = useState<{ trainings: TrainingCard[]; creators: CreatorCard[]; next: string | null } | null>(null);
  const [mine, setMine] = useState<{ mine: TrainingCard[]; joined: TrainingCard[] } | null>(null);
  const [error, setError] = useState(false);
  const { moves, reload } = useMyMoves(api);

  const search = useCallback(
    async (cursor?: string) => {
      setError(false);
      try {
        const r = await api.discover({ q: q.trim() || undefined, level: level || undefined, sort, cursor });
        setFound((old) => (cursor && old ? { ...r, trainings: [...old.trainings, ...r.trainings], creators: old.creators } : r));
      } catch {
        setError(true);
      }
    },
    [api, q, level, sort],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void search();
      void api
        .trainings()
        .then(setMine)
        .catch(() => setMine({ mine: [], joined: [] }));
    }, 0);
    return () => window.clearTimeout(id);
    // The first load; searching again is the form's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const open = (c: TrainingCard) => go({ name: "training", ref: c.code ?? c.id });
  const list = (cards: TrainingCard[], empty: string) =>
    cards.length ? (
      <div className="space-y-2">
        {cards.map((c) => (
          <TrainingCardRow
            key={c.id}
            name={c.name}
            minutes={c.minutes}
            level={c.level}
            creator={c.creator?.name}
            athletes={c.athletes}
            d={d}
            lang={lang}
            onClick={() => open(c)}
          />
        ))}
      </div>
    ) : (
      <Card>
        <Small>{empty}</Small>
      </Card>
    );

  return (
    <div className="space-y-4">
      <H1>{a.title}</H1>
      <Small>{a.lead}</Small>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="volt" onClick={() => go({ name: "build" })}>
          {a.build}
        </Btn>
        <Btn variant="ghost" onClick={() => go({ name: "teach" })}>
          {a.teachCta}
        </Btn>
      </div>
      <Segmented
        label={a.title}
        value={tab}
        onChange={setTab}
        options={[
          { value: "discover", label: a.discover },
          { value: "mine", label: a.mine },
          { value: "joined", label: a.joined },
        ]}
      />
      {tab === "discover" && (
        <>
          <form
            className="space-y-2"
            role="search"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void search();
            }}
          >
            <div className="flex gap-2">
              <input
                className={inputCls}
                type="search"
                value={q}
                placeholder={a.search}
                aria-label={a.search}
                onChange={(e) => setQ(e.target.value)}
              />
              <Btn type="submit">{a.searchGo}</Btn>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-11 rounded-xl border border-line bg-night px-3 text-sm"
                value={level}
                aria-label={d.app.builder.level}
                onChange={(e) => setLevel(e.target.value as TrainingLevel | "")}
              >
                <option value="">{a.anyLevel}</option>
                {TRAINING_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {d.share.level[l]}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-line bg-night px-3 text-sm"
                value={sort}
                aria-label="Sort"
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                {(["popular", "new", "coach"] as const).map((s) => (
                  <option key={s} value={s}>
                    {a.sort[s]}
                  </option>
                ))}
              </select>
            </div>
          </form>
          {error && <Note tone="butter">{a.loadError}</Note>}
          {!found && !error && <p className="text-muted">{d.share.loading}</p>}
          {found && found.creators.length > 0 && (
            <section className="space-y-2">
              <Kicker tone="sky">{a.coaches}</Kicker>
              <List>
                {found.creators.map((c) => (
                  <Row
                    key={c.handle}
                    title={c.name}
                    detail={`@${c.handle}${c.city ? ` · ${c.city}` : ""}`}
                    value={String(c.coachScore)}
                    onClick={() => go({ name: "creator", handle: c.handle })}
                  />
                ))}
              </List>
            </section>
          )}
          {found && list(found.trainings, a.noResults)}
          {found?.next && (
            <Btn variant="ghost" className="w-full" onClick={() => void search(found.next!)}>
              {a.more}
            </Btn>
          )}
        </>
      )}
      {tab === "mine" && (mine ? list(mine.mine, a.noneMine) : <p className="text-muted">{d.share.loading}</p>)}
      {tab === "joined" && (mine ? list(mine.joined, a.noneJoined) : <p className="text-muted">{d.share.loading}</p>)}

      <section className="space-y-2">
        <Kicker tone="sky">{a.myMoves}</Kicker>
        {moves && moves.length === 0 && (
          <Card>
            <Small>{a.noMoves}</Small>
          </Card>
        )}
        {moves && moves.length > 0 && (
          <List>
            {moves.map((m) => (
              <MoveRow key={m.id} m={m} label={a.deleteMove} onDelete={() => void api.deleteMove(m.id).then(reload)} />
            ))}
          </List>
        )}
      </section>
      <List>
        <Row title={a.profileCta} onClick={() => go({ name: "coach-profile" })} />
      </List>
    </div>
  );
}

function MoveRow({ m, label, onDelete }: { m: CustomMove; label: string; onDelete: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
        {ICON_GLYPH[m.icon] ?? "●"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words">{m.name}</span>
        <span className="block text-xs text-muted">{m.template.quality}</span>
      </span>
      <Btn variant={sure ? "danger" : "ghost"} onClick={() => (sure ? onDelete() : setSure(true))}>
        {label}
      </Btn>
    </div>
  );
}

// ── A training's page ──────────────────────────────────────────────────────────────────────────────────────────

type Loaded = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; shared: SharedTraining; mine: boolean };

/** A training by share code (the public route) or by id (mine, signed in), for its page and its run. */
export function useTrainingRef(ref: string): Loaded {
  const { apiUrl, me } = useApp();
  const { api } = useTrainings();
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    const none = { athletes: 0, runs: 0, totalReps: 0, heartPoints: 0, coachScore: 0 };
    void (async () => {
      try {
        if (ref.startsWith("t_")) {
          const full = await api.trainingFull(ref, me.id);
          if (!alive) return;
          if ("problem" in full.parsed) return setState({ kind: "missing" });
          const mine = full.mine;
          setState({
            kind: "ready",
            shared: {
              training: full.parsed.training,
              code: full.parsed.code,
              creator: { id: full.creatorId, name: mine ? (me.name ?? "") : (full.parsed.training.creator?.name ?? ""), handle: null },
              stats: none,
            },
            mine,
          });
          return;
        }
        const r = await publicTrainings(apiUrl).shared(ref);
        if (!alive) return;
        if (!("training" in r)) return setState({ kind: "missing" });
        // The signed-in view of it: whose it is (mine: edit and delete; theirs: their id for blocking).
        let mine = false;
        let creatorId: string | null = null;
        try {
          const full = await api.trainingFull(r.training.id, me.id);
          mine = full.mine;
          creatorId = full.creatorId;
        } catch {
          // The public view is enough to run it.
        }
        if (alive) setState({ kind: "ready", shared: { ...r, creator: { ...r.creator, id: creatorId } }, mine });
      } catch {
        if (alive) setState({ kind: "missing" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ref, api, apiUrl, me.id, me.name]);
  return state;
}

export function TrainingDetailScreen({ refId, challenge }: { refId: string; challenge?: string }) {
  const { lang, go, fmt } = useApp();
  const { api, d } = useTrainings();
  const a = d.app.detail;
  const state = useTrainingRef(refId);
  const [msg, setMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<null | "challenge" | "report" | "block" | "delete">(null);

  if (state.kind === "loading") return <p className="mt-10 text-muted">{d.app.run.loading}</p>;
  if (state.kind === "missing")
    return (
      <div className="space-y-4">
        <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
          ‹ {d.app.title}
        </Btn>
        <Card>{d.app.run.notFound}</Card>
      </div>
    );
  const { shared, mine } = state;
  const t = shared.training;
  const code = shared.code;
  const run = () => go({ name: "train", ref: code ?? t.id, ...(challenge ? { challenge } : {}) });
  const isJoined = joined ?? false;

  return (
    <div className="space-y-4">
      <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
        ‹ {d.app.title}
      </Btn>
      <TrainingView
        training={t}
        stats={mine ? null : shared.stats}
        lang={lang}
        d={d.share}
        creator={
          shared.creator.handle ? (
            <button type="button" className="underline" onClick={() => go({ name: "creator", handle: shared.creator.handle! })}>
              {fmt(d.share.by, { name: shared.creator.name })} · @{shared.creator.handle}
            </button>
          ) : shared.creator.name ? (
            fmt(d.share.by, { name: shared.creator.name })
          ) : null
        }
      />
      <Btn big variant="volt" className="w-full" onClick={run}>
        {a.run}
      </Btn>
      <Small>{d.app.run.webRule}</Small>
      <div className="flex flex-wrap gap-2">
        {!mine && (
          <Btn
            variant="ghost"
            onClick={() =>
              void (isJoined ? api.leave(t.id) : api.join(t.id))
                .then(() => {
                  setJoined(!isJoined);
                  setMsg(isJoined ? null : a.joinedNote);
                })
                .catch(() => setMsg(d.app.builder.error))
            }
          >
            {isJoined ? a.leave : a.join}
          </Btn>
        )}
        {code && t.visibility !== "private" && (
          <Btn
            variant="ghost"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(trainingShareUrl(window.location.origin, lang, code))
                .then(() => setCopied(true))
                .catch(() => undefined)
            }
          >
            {copied ? a.copied : a.share}
          </Btn>
        )}
        {t.visibility !== "private" && (
          <Btn variant="ghost" onClick={() => setPanel(panel === "challenge" ? null : "challenge")}>
            {a.challenge}
          </Btn>
        )}
        {mine && (
          <Btn variant="ghost" onClick={() => go({ name: "build", id: t.id })}>
            {a.edit}
          </Btn>
        )}
        {mine ? (
          <Btn variant="danger" onClick={() => setPanel("delete")}>
            {a.delete}
          </Btn>
        ) : (
          <>
            <Btn variant="ghost" onClick={() => setPanel("report")}>
              {a.report}
            </Btn>
            {shared.creator.id && (
              <Btn variant="ghost" onClick={() => setPanel("block")}>
                {a.block}
              </Btn>
            )}
          </>
        )}
      </div>
      {msg && <Note>{msg}</Note>}
      {panel === "challenge" && <ChallengeMaker training={t} lang={lang} code={code} />}
      {panel === "report" && <ReportForm kind="training" id={t.id} onDone={(m) => (setPanel(null), setMsg(m))} />}
      {panel === "block" && shared.creator.id && (
        <Card tone="butter">
          <Btn
            variant="danger"
            onClick={() =>
              void api
                .block(shared.creator.id!)
                .then(() => (setPanel(null), setMsg(a.blocked)))
                .catch(() => setMsg(d.app.builder.error))
            }
          >
            {a.blockConfirm}
          </Btn>
        </Card>
      )}
      {panel === "delete" && (
        <Card tone="butter">
          <Btn
            variant="danger"
            onClick={() =>
              void api
                .deleteTraining(t.id)
                .then(() => go({ name: "trainings" }))
                .catch(() => setMsg(d.app.builder.error))
            }
          >
            {a.deleteConfirm}
          </Btn>
        </Card>
      )}
    </div>
  );
}

function ChallengeMaker({ training, lang, code }: { training: Training; lang: "en" | "fr"; code: string | null }) {
  const { api, d } = useTrainings();
  const { fmt } = useApp();
  const a = d.app.detail;
  const [hours, setHours] = useState<24 | 72 | 168>(72);
  const [showName, setShowName] = useState(true);
  const [made, setMade] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  return (
    <Card>
      <Kicker tone="pulse">{a.challenge}</Kicker>
      <div className="mt-3 space-y-3">
        <Segmented
          label={a.challengeWindow}
          value={String(hours) as "24" | "72" | "168"}
          onChange={(v) => setHours(Number(v) as 24 | 72 | 168)}
          options={[
            { value: "24", label: fmt(a.hours, { n: 24 }) },
            { value: "72", label: fmt(a.days, { n: 3 }) },
            { value: "168", label: fmt(a.days, { n: 7 }) },
          ]}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{a.challengeShowName}</span>
          <Toggle on={showName} onChange={setShowName} label={a.challengeShowName} />
        </div>
        {made ? (
          <>
            <input className={inputCls} readOnly value={made} onFocus={(e) => e.target.select()} aria-label={a.challenge} />
            <Small>{a.challengeReady}</Small>
          </>
        ) : (
          <Btn
            onClick={() =>
              void api
                .challenge(training.id, hours, showName)
                .then((r) => setMade(r.url ?? (r.code && code ? trainingShareUrl(window.location.origin, lang, code, r.code) : null)))
                .catch(() => setErr(true))
            }
          >
            {a.challengeCreate}
          </Btn>
        )}
        {err && <Note tone="butter">{d.app.builder.error}</Note>}
      </div>
    </Card>
  );
}

export function ReportForm({ kind, id, onDone }: { kind: "training" | "move" | "profile"; id: string; onDone: (msg: string) => void }) {
  const { lang } = useApp();
  const { api, d } = useTrainings();
  const a = d.app.detail;
  const [reason, setReason] = useState<ReportReason>("offensive");
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  return (
    <Card>
      <Kicker tone="butter">{a.reportTitle}</Kicker>
      <div className="mt-3 space-y-2">
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex min-h-10 items-center gap-2 text-sm">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5" />
            {REPORT_REASON_TEXT[r][lang]}
          </label>
        ))}
        <Field label={a.reportNote}>
          <input className={inputCls} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Btn
          onClick={() =>
            void api
              .report(kind, id, reason, note.trim() || undefined)
              .then(() => onDone(a.reported))
              .catch(() => setErr(true))
          }
        >
          {a.reportSend}
        </Btn>
        {err && <Note tone="butter">{d.app.builder.error}</Note>}
      </div>
    </Card>
  );
}

// ── The builder ─────────────────────────────────────────────────────────────────────────────────────────────────

export function BuilderScreen({ id }: { id?: string }) {
  const { lang, go, fmt } = useApp();
  const { api, d } = useTrainings();
  const b = d.app.builder;
  const { moves } = useMyMoves(api);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [extraMoves, setExtraMoves] = useState<CustomMove[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    void api
      .training(id)
      .then((r) => {
        if ("training" in r) {
          setDraft(draftOf(r.training));
          setExtraMoves(r.training.moves);
        }
      })
      .catch(() => setMsg({ text: b.error }));
  }, [id, api, b.error]);

  const allMoves = useMemo(() => {
    const mine = moves ?? [];
    return [...mine, ...extraMoves.filter((m) => !mine.some((x) => x.id === m.id))];
  }, [moves, extraMoves]);
  const list = builderMoves(allMoves, lang);
  const check = checkDraft(draft, allMoves, lang);
  const estimate = "training" in check ? { min: trainingMinutes(check.training), sets: trainingSets(check.training).length } : null;
  const set = (i: number, p: Partial<DraftSet>) => setDraft((x) => ({ ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, ...p } : s)) }));

  const save = async () => {
    if ("problem" in check) return setMsg({ text: b.problems[check.problem] });
    setBusy(true);
    setMsg(null);
    try {
      const body = draftBody(draft, allMoves, lang);
      if (draft.id) {
        await api.updateTraining(draft.id, body);
        go({ name: "training", ref: draft.id });
      } else {
        const r = await api.createTraining(body);
        setMsg({ text: b.saved, ok: true });
        const made = r.raw && typeof r.raw === "object" ? (r.raw as { id?: unknown }).id : null;
        if (r.code) go({ name: "training", ref: r.code });
        else if (typeof made === "string") go({ name: "training", ref: made });
      }
    } catch (e) {
      setMsg({ text: errorText(e, b) });
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

  return (
    <div className="space-y-4">
      <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
        ‹ {d.app.title}
      </Btn>
      <H1>{draft.id ? b.editTitle : b.title}</H1>
      <Field label={b.name}>
        <input className={inputCls} maxLength={48} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={b.description}>
        <textarea
          className={cn(inputCls, "h-24 py-2")}
          maxLength={280}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </Field>
      <Field label={b.tags}>
        <input className={inputCls} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium">{b.level}</span>
        <Segmented
          label={b.level}
          value={draft.level}
          onChange={(v) => setDraft({ ...draft, level: v })}
          options={TRAINING_LEVELS.map((l) => ({ value: l, label: d.share.level[l] }))}
        />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">{b.visibility}</span>
        <div className="space-y-1">
          {(["public", "unlisted", "private"] as TrainingVisibility[]).map((v) => (
            <label key={v} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="radio"
                name="vis"
                className="h-5 w-5"
                checked={draft.visibility === v}
                onChange={() => setDraft({ ...draft, visibility: v })}
              />
              {b.vis[v]}
            </label>
          ))}
        </div>
      </div>

      <Kicker tone="sky">{b.sets}</Kicker>
      <div className="space-y-3">
        {draft.sets.map((s, i) => {
          const kind = kindOf(s.move, allMoves);
          return (
            <Card key={i}>
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold">{i + 1}</span>
                <div className="flex gap-1">
                  <Btn
                    variant="ghost"
                    aria-label={b.up}
                    disabled={i === 0}
                    onClick={() => setDraft({ ...draft, sets: moveSet(draft.sets, i, -1) })}
                  >
                    ↑
                  </Btn>
                  <Btn
                    variant="ghost"
                    aria-label={b.down}
                    disabled={i === draft.sets.length - 1}
                    onClick={() => setDraft({ ...draft, sets: moveSet(draft.sets, i, 1) })}
                  >
                    ↓
                  </Btn>
                  <Btn variant="ghost" onClick={() => setDraft({ ...draft, sets: draft.sets.filter((_, j) => j !== i) })}>
                    {b.remove}
                  </Btn>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2 block text-sm">
                  {b.move}
                  <select
                    className="mt-1 h-12 w-full rounded-xl border border-line bg-night px-3"
                    value={s.move}
                    onChange={(e) => set(i, { move: e.target.value, amount: newSet(e.target.value, allMoves).amount })}
                  >
                    {list.mine.length > 0 && (
                      <optgroup label={b.myMoves}>
                        {list.mine.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={b.catalogue}>
                      {list.catalogue.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="block text-sm">
                  {kind === "hold" ? b.holdS : b.reps}
                  <input
                    className={cn(inputCls, "mt-1")}
                    inputMode="numeric"
                    value={s.amount}
                    onChange={(e) => set(i, { amount: num(e.target.value, 0, kind === "hold" ? 600 : 200) })}
                  />
                </label>
                <label className="block text-sm">
                  {b.restS}
                  <input
                    className={cn(inputCls, "mt-1")}
                    inputMode="numeric"
                    value={s.restS}
                    onChange={(e) => set(i, { restS: num(e.target.value, 0, 600) })}
                  />
                </label>
                <label className="col-span-2 block text-sm">
                  {b.intensity}
                  <select
                    className="mt-1 h-12 w-full rounded-xl border border-line bg-night px-3"
                    value={s.intensity === "zone" ? `z${s.zone}` : s.intensity === "effort" ? `e${s.rpe}` : "none"}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "none") set(i, { intensity: "none" });
                      else if (v.startsWith("z")) set(i, { intensity: "zone", zone: Number(v.slice(1)) });
                      else set(i, { intensity: "effort", rpe: Number(v.slice(1)) });
                    }}
                  >
                    <option value="none">{b.none}</option>
                    {[1, 2, 3, 4, 5].map((z) => (
                      <option key={`z${z}`} value={`z${z}`}>
                        {fmt(b.zone, { n: z })}
                      </option>
                    ))}
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((e) => (
                      <option key={`e${e}`} value={`e${e}`}>
                        {fmt(b.effort, { n: e })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>
          );
        })}
      </div>
      {canAddSet(draft) && (
        <Btn
          variant="ghost"
          className="w-full"
          onClick={() =>
            setDraft({ ...draft, sets: [...draft.sets, { ...(draft.sets[draft.sets.length - 1] ?? newSet("squat", allMoves)) }] })
          }
        >
          + {b.addSet}
        </Btn>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label={b.rounds}>
          <input
            className={inputCls}
            inputMode="numeric"
            value={draft.rounds}
            onChange={(e) => setDraft({ ...draft, rounds: num(e.target.value, 1, 10) })}
          />
        </Field>
        {draft.rounds > 1 && (
          <Field label={b.roundRestS}>
            <input
              className={inputCls}
              inputMode="numeric"
              value={draft.roundRestS}
              onChange={(e) => setDraft({ ...draft, roundRestS: num(e.target.value, 0, 600) })}
            />
          </Field>
        )}
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium">{b.restRule}</span>
        <Segmented
          label={b.restRule}
          value={draft.rest}
          onChange={(v) => setDraft({ ...draft, rest: v })}
          options={[
            { value: "flex", label: b.flex },
            { value: "fixed", label: b.fixed },
          ]}
        />
      </div>
      {estimate && <Small>{fmt(b.estimate, { min: estimate.min, sets: estimate.sets })}</Small>}
      {"problem" in check && draft.name.trim() && <Note tone="butter">{b.problems[check.problem]}</Note>}
      {msg && <Note tone={msg.ok ? "volt" : "butter"}>{msg.text}</Note>}
      <Btn big variant="volt" className="w-full" disabled={busy} onClick={() => void save()}>
        {busy ? b.saving : b.save}
      </Btn>
    </div>
  );
}

// ── My coach profile ────────────────────────────────────────────────────────────────────────────────────────────

export function CoachProfileScreen() {
  const { lang, go, me } = useApp();
  const { api, d } = useTrainings();
  const p = d.app.profile;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .myProfile()
      .then((r) => {
        setProfile(r);
        setHandle(r.handle ?? "");
      })
      .catch(() => setProfile({ handle: null, public: false, bio: "", showCity: false }));
    void api
      .creatorStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [api]);

  if (!profile) return <p className="mt-10 text-muted">{d.share.loading}</p>;
  const save = async () => {
    const h = handle.trim().toLowerCase();
    if (h && !CREATOR_HANDLE.test(h)) return setMsg({ text: p.badHandle });
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.updateProfile({
        ...(h ? { handle: h } : {}),
        public: profile.public,
        bio: profile.bio,
        showCity: profile.showCity,
      });
      setProfile(r);
      setMsg({ text: p.saved, ok: true });
    } catch (e) {
      setMsg({
        text: e instanceof ApiError && e.status === 409 ? p.taken : e instanceof ApiError && e.status === 422 ? d.app.builder.ugc : p.error,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
        ‹ {d.app.title}
      </Btn>
      <H1>{p.title}</H1>
      <Small>{p.lead}</Small>
      <Card>
        <div className="space-y-3">
          <Field label={p.handle} hint={p.handleHint}>
            <input
              className={inputCls}
              autoCapitalize="off"
              maxLength={20}
              value={handle}
              placeholder={me.name?.toLowerCase().replace(/[^a-z0-9_]/g, "") ?? ""}
              onChange={(e) => setHandle(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{p.public}</span>
              <span className="block text-xs text-muted">{p.publicHint}</span>
            </span>
            <Toggle on={profile.public} onChange={(v) => setProfile({ ...profile, public: v })} label={p.public} />
          </div>
          <Field label={p.bio}>
            <textarea
              className={cn(inputCls, "h-20 py-2")}
              maxLength={140}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{p.showCity}</span>
            <Toggle on={profile.showCity} onChange={(v) => setProfile({ ...profile, showCity: v })} label={p.showCity} />
          </div>
          {msg && <Note tone={msg.ok ? "volt" : "butter"}>{msg.text}</Note>}
          <Btn variant="volt" className="w-full" disabled={busy} onClick={() => void save()}>
            {p.save}
          </Btn>
          {profile.public && profile.handle && (
            <a className="block text-center text-sm underline" href={`/${lang}/coach/#${profile.handle}`}>
              {p.page}
            </a>
          )}
        </div>
      </Card>
      <Card tone="pulse">
        <Kicker tone="pulse">{p.points}</Kicker>
        {stats && (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                [p.today, stats.pointsToday],
                [p.week, stats.pointsWeek],
                [p.qualifying, stats.qualifyingWeek],
                [p.coachScore, stats.coachScore],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-xl bg-surface-2 p-2">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <Small className="mt-3">{p.pointsRule}</Small>
        <Small className="mt-1">{p.webRule}</Small>
        <a className="mt-2 block text-sm underline" href={`/${lang}/rewards/#creators`}>
          {p.shareLink}
        </a>
      </Card>
    </div>
  );
}

// ── A creator, signed in (follow) ───────────────────────────────────────────────────────────────────────────────

export function CreatorScreen({ handle }: { handle: string }) {
  const { lang, go } = useApp();
  const { api, d } = useTrainings();
  const c = d.creator;
  const [page, setPage] = useState<{ creator: CreatorCard; trainings: TrainingCard[] } | null | "missing">(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [panel, setPanel] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void api
      .creator(handle)
      .then((r) => setPage(r ?? "missing"))
      .catch(() => setPage("missing"));
  }, [api, handle]);
  if (page === null) return <p className="mt-10 text-muted">{c.loading}</p>;
  if (page === "missing")
    return (
      <div className="space-y-4">
        <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
          ‹ {d.app.title}
        </Btn>
        <Card>{c.notFound}</Card>
      </div>
    );
  const f = following ?? page.creator.following;
  return (
    <div className="space-y-4">
      <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
        ‹ {d.app.title}
      </Btn>
      <Kicker tone="pulse">{c.kicker}</Kicker>
      <H1>{page.creator.name}</H1>
      <Small>
        @{page.creator.handle}
        {page.creator.city ? ` · ${page.creator.city}` : ""}
      </Small>
      {page.creator.bio && <p className="break-words">{page.creator.bio}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            [c.followers, page.creator.followers],
            [c.joins, page.creator.joins],
            [c.coachScore, page.creator.coachScore],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-2">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="font-display text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn
          variant={f ? "ghost" : "volt"}
          onClick={() =>
            void (f ? api.unfollow(handle) : api.follow(handle)).then(() => setFollowing(!f)).catch(() => setMsg(d.app.builder.error))
          }
        >
          {f ? c.following : c.follow}
        </Btn>
        <Btn variant="ghost" onClick={() => setPanel(!panel)}>
          {d.app.detail.report}
        </Btn>
      </div>
      {panel && <ReportForm kind="profile" id={handle} onDone={(m) => (setPanel(false), setMsg(m))} />}
      {msg && <Note>{msg}</Note>}
      <Kicker tone="sky">{c.trainings}</Kicker>
      <div className="space-y-2">
        {page.trainings.length ? (
          page.trainings.map((t) => (
            <TrainingCardRow
              key={t.id}
              name={t.name}
              minutes={t.minutes}
              level={t.level}
              athletes={t.athletes}
              d={d}
              lang={lang}
              onClick={() => go({ name: "training", ref: t.code ?? t.id })}
            />
          ))
        ) : (
          <Small>{c.none}</Small>
        )}
      </div>
      <Small>{c.scoreNote}</Small>
    </div>
  );
}
