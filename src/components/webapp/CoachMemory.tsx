"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getTalkDict, type TalkDict } from "@/i18n/talk";
import { ApiError } from "@/lib/rewardsApi";
import { MEMORY_KINDS, MEMORY_TEXT_MAX, namesDiagnosis, type CoachMemoryItem, type MemoryKind } from "@/lib/webapp/coach/coachMemory";
import { metricValue, metricWord } from "@/lib/webapp/coach/coachActions";
import type { DataCorrection } from "@/lib/webapp/coach/dataCorrections";
import { memoryGroups, talkApi, type MemoryEdit } from "@/lib/webapp/coach/talkApi";
import { useApp } from "./AppContext";
import { Btn, Card, H1, H2, inputCls, Small } from "./ui";

/**
 * You › Coach memory ("What your coach remembers", ADR-0068 / ADR-0038): every line the coach keeps, grouped by kind,
 * each one correctable and deletable, delete everything, add a line; then the Health numbers the athlete corrected,
 * each undoable. Health-first: a line that names a medical condition isn't kept (game-core namesDiagnosis, and the
 * API checks again).
 */
export function CoachMemoryScreen() {
  const { lang, session, go, t } = useApp();
  const tk = getTalkDict(lang);
  const api = useMemo(() => talkApi(session), [session]);
  const [items, setItems] = useState<CoachMemoryItem[] | null | undefined>(undefined);
  const [fixes, setFixes] = useState<DataCorrection[] | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .memory()
      .then(setItems)
      .catch(() => setItems(null));
    api
      .corrections()
      .then(setFixes)
      .catch(() => setFixes(null));
  }, [api]);
  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const run = async (fn: () => Promise<unknown>, after?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (after) setMsg(after);
      load();
      return true;
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 400 ? tk.memory.rejected : tk.memory.error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const groups = items ? memoryGroups(items) : [];
  return (
    <div className="space-y-5">
      <button type="button" className="text-sm text-muted" onClick={() => go({ name: "you" })}>
        ‹ {t.tabs.you}
      </button>
      <H1>{tk.memory.title}</H1>
      <Small>
        {tk.memory.lead}{" "}
        <a className="underline" href={`/${lang}/privacy/`}>
          {tk.memory.privacy}
        </a>
      </Small>

      {items === undefined ? (
        <Small>…</Small>
      ) : items === null ? (
        <p className="text-sm text-down-fg">{tk.memory.error}</p>
      ) : groups.length === 0 ? (
        <Card>
          <Small>{tk.memory.empty}</Small>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.kind} aria-labelledby={`mem-${g.kind}`}>
            <H2 className="mb-2">
              <span id={`mem-${g.kind}`}>{tk.memory.kinds[g.kind]}</span>
            </H2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {g.items.map((m) => (
                <MemoryRow
                  key={m.id}
                  m={m}
                  tk={tk}
                  busy={busy}
                  onSave={(b) => run(() => api.editMemory(m.id, b))}
                  onDelete={() => void run(() => api.forget(m.id))}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <AddLine tk={tk} busy={busy} onAdd={(b) => run(() => api.addMemory(b))} onRejected={() => setMsg(tk.memory.rejected)} />

      {!!items?.length && (
        <Btn
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm(tk.memory.deleteAllConfirm)) void run(() => api.forgetAll());
          }}
        >
          {tk.memory.deleteAll}
        </Btn>
      )}
      {msg && (
        <p role="status" className="text-sm text-butter-fg">
          {msg}
        </p>
      )}

      <section aria-labelledby="corrections" className="space-y-2 pt-2">
        <H2>
          <span id="corrections">{tk.corrections.title}</span>
        </H2>
        <Small>{tk.corrections.lead}</Small>
        {fixes === undefined ? null : !fixes?.length ? (
          <Small>{fixes === null ? tk.memory.error : tk.corrections.empty}</Small>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {fixes.map((c) => {
              const L = lang === "fr" ? "fr" : "en";
              return (
                <li key={`${c.metric}-${c.day}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {metricWord(c.metric, L)} · {metricValue(c.metric, c.value, L)}{" "}
                      <span className="text-xs text-lilac-fg">({tk.corrections.mark})</span>
                    </p>
                    <p className="text-xs text-faint">
                      {c.day}
                      {c.shown !== undefined ? ` · ${tk.corrections.health.replace("{v}", metricValue(c.metric, c.shown, L))}` : ""}
                    </p>
                  </div>
                  <Btn
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void run(() => api.undoCorrection(c.metric, c.day), tk.corrections.undone)}
                  >
                    {tk.corrections.undo}
                  </Btn>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MemoryRow({
  m,
  tk,
  busy,
  onSave,
  onDelete,
}: {
  m: CoachMemoryItem;
  tk: TalkDict;
  busy: boolean;
  onSave: (b: MemoryEdit) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  const [kind, setKind] = useState<MemoryKind>(m.kind);
  const bad = namesDiagnosis(text);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (bad || text.trim().length < 3) return;
    if (await onSave({ text: text.trim(), ...(kind !== m.kind ? { kind } : {}) })) setEditing(false);
  };
  if (editing)
    return (
      <li className="px-4 py-3">
        <form onSubmit={submit} className="space-y-2">
          <input
            className={inputCls}
            value={text}
            maxLength={MEMORY_TEXT_MAX}
            aria-label={tk.memory.edit}
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
          <KindSelect tk={tk} value={kind} onChange={setKind} />
          {bad && <Small className="text-butter-fg">{tk.memory.rejected}</Small>}
          <div className="flex gap-2">
            <Btn type="submit" variant="volt" disabled={busy || bad || text.trim().length < 3}>
              {tk.memory.save}
            </Btn>
            <Btn variant="ghost" onClick={() => (setEditing(false), setText(m.text), setKind(m.kind))}>
              {tk.memory.cancel}
            </Btn>
          </div>
        </form>
      </li>
    );
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm">{m.text}</p>
        <p className="mt-0.5 text-xs text-faint">
          {[m.on, tk.memory.sources[m.source]].filter(Boolean).join(" · ")}
          {m.kind === "injury" && m.active === false ? ` · ${tk.memory.healed}` : ""}
        </p>
        {m.kind === "injury" && (
          <button
            type="button"
            className="mt-1 text-xs text-sky-fg underline"
            disabled={busy}
            onClick={() => void onSave({ active: m.active === false })}
          >
            {m.active === false ? tk.memory.active : tk.memory.healed}
          </button>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Btn variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
          {tk.memory.edit}
        </Btn>
        <Btn variant="ghost" disabled={busy} onClick={onDelete} aria-label={`${tk.memory.delete}: ${m.text}`}>
          {tk.memory.delete}
        </Btn>
      </div>
    </li>
  );
}

function KindSelect({ tk, value, onChange }: { tk: TalkDict; value: MemoryKind; onChange: (k: MemoryKind) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{tk.memory.kind}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as MemoryKind)}>
        {MEMORY_KINDS.map((k) => (
          <option key={k} value={k}>
            {tk.memory.kinds[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddLine({
  tk,
  busy,
  onAdd,
  onRejected,
}: {
  tk: TalkDict;
  busy: boolean;
  onAdd: (b: { kind: MemoryKind; text: string; on?: string }) => Promise<boolean>;
  onRejected: () => void;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<MemoryKind>("preference");
  const [on, setOn] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 3) return;
    if (namesDiagnosis(t)) return onRejected();
    if (await onAdd({ kind, text: t, ...(on ? { on } : {}) })) {
      setText("");
      setOn("");
    }
  };
  return (
    <Card>
      <form onSubmit={submit} className="space-y-2">
        <p className="text-sm font-semibold">{tk.memory.add}</p>
        <input
          className={inputCls}
          value={text}
          maxLength={MEMORY_TEXT_MAX}
          placeholder={tk.memory.addPlaceholder}
          aria-label={tk.memory.addPlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
        <KindSelect tk={tk} value={kind} onChange={setKind} />
        {(kind === "injury" || kind === "life_event" || kind === "goal" || kind === "win") && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">{tk.memory.day}</span>
            <input className={inputCls} type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </label>
        )}
        <Btn type="submit" variant="volt" disabled={busy || text.trim().length < 3}>
          {tk.memory.add}
        </Btn>
      </form>
    </Card>
  );
}
