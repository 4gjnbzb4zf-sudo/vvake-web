"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { getSeasonDict } from "@/i18n/season";
import { fmt } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import { localTz } from "@/lib/webapp/api";
import { dayLabel, localDay } from "@/lib/webapp/format";
import { zoneThresholds } from "@/lib/webapp/heart";
import {
  addEdit,
  changeEdit,
  choiceLine,
  dismiss,
  draftOfSession,
  draftSummary,
  duplicateEdit,
  emptySheet,
  isDismissed,
  missedActions,
  parseKm,
  SESSION_TYPES,
  undoIds,
  usable,
  withType,
  withZone,
  zoneRangeText,
  type SheetDraft,
} from "@/lib/webapp/planEdit";
import {
  editable,
  weekDates,
  type EditDraft,
  type PlanWarningView,
  type SeasonAnswer,
  type SeasonSessionView,
  type ServerEdit,
} from "@/lib/webapp/season";
import { heartForSport, hrIsRoughGuide } from "@/lib/webapp/sportHeart";
import { sportLabel, WEB_SPORTS } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { useSeason } from "./useSeason";
import { Btn, Card, inputCls, Kicker, Note, Segmented, Small, Toggle } from "./ui";
import { useNow } from "./useNow";

/**
 * Editing the week by hand (VVFit ADR-0052, the phone's plan tab): the skipped-session card (postpone it, shorter
 * today, skip it, or rest when unwell), the quick edit sheet for any planned session (and "Add a session"), and the
 * coach's gentle note after an edit with its one-tap rebalance. Every edit applies at once, with Undo; a note never
 * blocks one. Pure parts: lib/webapp/planEdit.ts.
 */

type AnyEdit = EditDraft | ServerEdit;
export type EditToastState = { text: string; ids: string[]; tone: "mint" | "down" } | null;

/** Applies edits (one, or a batch), keeps the ids to undo, and says when the week's notes should show. */
export function useEditApply(adopt: (a: SeasonAnswer) => void) {
  const { api, lang, t } = useApp();
  const s = getSeasonDict(lang);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<EditToastState>(null);
  const [notes, setNotes] = useState(false);

  const apply = useCallback(
    async (edits: AnyEdit[], words?: (line: string) => string): Promise<boolean> => {
      if (!edits.length) return false;
      setBusy(true);
      try {
        const r = edits.length === 1 ? await api.seasonEdit(edits[0]!, localTz(), lang) : await api.seasonEdits(edits, localTz(), lang);
        adopt(r);
        const line = r.line ?? "";
        setToast({
          text: words ? words(line) : line ? fmt(s.week.changedTo, { line }) : s.proposal.approved,
          ids: undoIds(r),
          tone: "mint",
        });
        setNotes(true);
        return true;
      } catch {
        setToast({ text: t.common.error, ids: [], tone: "down" });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api, lang, adopt, s, t.common.error],
  );

  const undo = useCallback(async () => {
    const ids = toast?.ids ?? [];
    if (!ids.length) return;
    setBusy(true);
    try {
      let last: SeasonAnswer | null = null;
      for (const id of [...ids].reverse()) last = await api.undoSeasonEdit(id, localTz(), lang);
      if (last) adopt(last);
      setToast({ text: s.week.undone, ids: [], tone: "mint" });
    } catch {
      setToast({ text: t.common.error, ids: [], tone: "down" });
    } finally {
      setBusy(false);
    }
  }, [api, lang, adopt, toast, s.week.undone, t.common.error]);

  return { busy, toast, apply, undo, notes, hideNotes: () => setNotes(false), clear: () => setToast(null) };
}
export type EditApply = ReturnType<typeof useEditApply>;

/** "Done: …" with Undo (announced to screen readers). */
export function EditToast({ h }: { h: EditApply }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  if (!h.toast) return null;
  return (
    <div role="status" aria-live="polite">
      <Note tone={h.toast.tone}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0">{h.toast.text}</span>
          {h.toast.ids.length > 0 && (
            <button type="button" className="min-h-11 px-2 font-semibold underline" disabled={h.busy} onClick={() => void h.undo()}>
              {s.week.undoThis}
            </button>
          )}
        </span>
      </Note>
    </div>
  );
}

/** The coach's gentle notes after an edit, each with a one-tap "Rebalance" (never blocking the edit). */
export function WarningNotes({ warnings, h }: { warnings: readonly PlanWarningView[]; h: EditApply }) {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  if (!h.notes || !warnings.length) return null;
  return (
    <>
      {warnings.map((w, i) => (
        <Card key={`${w.kind}-${i}`} tone="lilac">
          <Kicker tone="lilac">{s.warn.kicker}</Kicker>
          <p className="mt-1.5 text-[15px]">{w.text}</p>
          {w.lines.length > 0 && <Small className="mt-1">{w.lines.join(" · ")}</Small>}
          <div className="mt-3 flex flex-wrap gap-2">
            {w.rebalance.length > 0 && (
              <Btn
                variant="volt"
                disabled={h.busy}
                onClick={() => void h.apply(w.rebalance, (line) => fmt(s.warn.rebalanced, { line: line || w.lines.join(" · ") || w.text }))}
              >
                {s.warn.rebalance}
              </Btn>
            )}
            <Btn variant="ghost" disabled={h.busy} onClick={h.hideNotes}>
              {s.warn.keep}
            </Btn>
          </div>
        </Card>
      ))}
    </>
  );
}

// ── The skipped session ───────────────────────────────────────────────────────────────────────────────────────────

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * "You skipped Tempo run · 45 min. Postpone it?" (GET /v1/season `missed`): Tomorrow (or the best day) in one tap,
 * Pick a day (the next 7, the ones that don't work say why), Make it shorter today, Skip it (no guilt). Each shows
 * its trade-offs in one line. Unwell: rest first. "Not now" closes it for today on this device.
 */
export function SkippedCard() {
  const { lang } = useApp();
  const s = getSeasonDict(lang);
  const { season, adopt } = useSeason();
  const h = useEditApply(adopt);
  const today = localDay(useNow());
  const [picking, setPicking] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const m = season?.missed ?? null;
  const id = m?.session.id ?? "";
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setStored(id ? isDismissed(storage(), today, id) : false), 0);
    return () => window.clearTimeout(t);
  }, [id, today]);

  const toast = <EditToast h={h} />;
  if (!m || stored !== false || closed === id) return h.toast ? toast : null;
  const a = missedActions(m);
  const go = (edit: ServerEdit, extra: string, skipped = false) =>
    void h.apply([edit], (line) => (skipped ? s.missed.skipped : fmt(s.missed.moved, { line: [line, extra].filter(Boolean).join(" · ") })));

  return (
    <>
      <Card tone={m.unwell ? "mint" : "butter"}>
        <Kicker tone={m.unwell ? "mint" : "butter"}>{s.missed.kicker}</Kicker>
        <p className="mt-1.5 font-display text-[17px] font-semibold">{m.title}</p>
        {m.body && <Small className="mt-1">{m.body}</Small>}
        <div className="mt-3 flex flex-col gap-2">
          {a.quick?.edit && (
            <ChoiceBtn
              variant="volt"
              label={a.quick.label || s.missed.tomorrow}
              line={choiceLine(a.quick)}
              disabled={h.busy}
              onClick={() => go(a.quick!.edit!, choiceLine(a.quick))}
            />
          )}
          {a.days.length > 0 && (
            <Btn variant="ghost" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
              {picking ? s.missed.pickClose : s.missed.pick}
            </Btn>
          )}
          {picking && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {a.days.map((c) => (
                <li key={c.to}>
                  <ChoiceBtn
                    variant="ghost"
                    label={c.label || dayLabel(`${c.to}T12:00:00`, lang)}
                    line={usable(c) ? choiceLine(c) : c.whyText || s.missed.noRoom}
                    disabled={h.busy || !usable(c)}
                    onClick={() => usable(c) && go(c.edit, choiceLine(c))}
                  />
                </li>
              ))}
            </ul>
          )}
          {a.today?.edit && (
            <ChoiceBtn
              variant="ghost"
              label={s.missed.shorter}
              line={[a.today.minutes ? `${a.today.minutes} min` : "", choiceLine(a.today)].filter(Boolean).join(" · ")}
              disabled={h.busy}
              onClick={() => go(a.today!.edit!, choiceLine(a.today))}
            />
          )}
          {a.skip && (
            <Btn variant={m.unwell ? "volt" : "ghost"} disabled={h.busy} onClick={() => go(a.skip!, "", true)}>
              {m.unwell ? s.missed.rest : s.missed.skip}
            </Btn>
          )}
          <button
            type="button"
            className="min-h-11 self-start px-1 text-sm text-muted underline"
            onClick={() => {
              dismiss(storage(), today, id);
              setClosed(id);
            }}
          >
            {s.missed.notNow}
          </button>
        </div>
      </Card>
      {toast}
    </>
  );
}

function ChoiceBtn({
  label,
  line,
  variant,
  disabled,
  onClick,
}: {
  label: string;
  line: string;
  variant: "volt" | "ghost";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full flex-col items-start justify-center rounded-xl px-4 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "volt" ? "bg-volt text-ink hover:brightness-95" : "border border-line bg-surface-2 text-text hover:border-muted/60",
      )}
    >
      <span className="font-display text-sm font-semibold">{label}</span>
      {line && <span className={cn("mt-0.5 text-xs", variant === "volt" ? "text-ink/75" : "text-muted")}>{line}</span>}
    </button>
  );
}

// ── The quick edit sheet ──────────────────────────────────────────────────────────────────────────────────────────

/** A modal sheet: Escape closes it, focus goes in on open and back to the opener on close. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      opener?.focus?.();
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-3xl border border-line bg-surface p-4 outline-none sm:rounded-3xl"
      >
        {children}
      </div>
    </div>
  );
}

const lbl = "mb-1 block text-xs font-semibold text-muted";

/**
 * One screen for a planned session (or a new one): sport, duration and distance, type, intensity (a zone with its
 * heart-rate range when your zones are known, or effort out of 10), day and time, a note, Lock, Duplicate, Swap,
 * Remove. The summary on top follows every change; Save sends one `change` with only what changed.
 */
export function SessionSheet({
  session,
  date,
  days,
  others,
  today,
  busy,
  onApply,
  onClose,
}: {
  /** The session to edit; null: "Add a session" on `date`. */
  session: SeasonSessionView | null;
  date: string;
  /** The week's dates (Monday first). */
  days: string[];
  /** The week's other sessions (to swap with). */
  others: SeasonSessionView[];
  today: string;
  busy: boolean;
  onApply: (edits: AnyEdit[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const { lang, athlete, heartZones } = useApp();
  const s = getSeasonDict(lang);
  const sh = s.sheet;
  const uid = useId();
  const [d, setD] = useState<SheetDraft>(() => (session ? draftOfSession(session) : emptySheet(date)));
  const [kmText, setKmText] = useState(d.distanceKm !== null ? String(d.distanceKm) : "");
  const [mode, setMode] = useState<"zone" | "rpe">(d.zone === null && d.rpe !== null ? "rpe" : "zone");
  const open = days.filter((x) => editable(x, today));
  const [dupTo, setDupTo] = useState(open.find((x) => x !== d.date) ?? open[0] ?? "");
  const swappable = others.filter((o) => editable(o.date, today) && o.id !== session?.id && !o.skipped);
  const [swap, setSwap] = useState(swappable[0]?.id ?? "");
  const name = (k: string) => sportLabel(k, lang);
  const summary = draftSummary(d, lang, name);
  const change = session ? changeEdit(session, d) : null;

  // The zone's heart-rate range, only when the account knows your heart (shared age and resting HR, or your zones).
  const h = athlete?.health;
  const knowsHeart = !!h && ((!!h.age && !!h.restingHr) || !!h.zones?.[d.sport]) && !heartZones?.rpe && !hrIsRoughGuide(d.sport);
  const thresholds = knowsHeart ? zoneThresholds(heartForSport(h, d.sport, heartZones)) : null;
  const range = (z: number) => (thresholds ? zoneRangeText(thresholds, z) : null);

  const run = async (edits: AnyEdit[]) => {
    if (await onApply(edits)) onClose();
  };
  const sportValue = d.trainingId ? `training:${d.trainingId}` : d.sport;

  return (
    <Sheet label={session ? sh.title : sh.addTitle} onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{session ? sh.title : sh.addTitle}</h2>
          <p className="mt-1 text-sm font-semibold break-words text-volt-fg" aria-live="polite">
            {summary}
          </p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 px-2 text-sm text-muted underline">
          {sh.close}
        </button>
      </div>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          if (session) {
            if (change) void run([change]);
          } else if (d.minutes >= 5) void run([addEdit(d)]);
        }}
      >
        <label className="block">
          <span className={lbl}>{sh.sport}</span>
          <select
            className={inputCls}
            value={sportValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("training:") && session?.trainingId)
                setD({ ...d, sport: session.sport, trainingId: session.trainingId, title: session.title ?? null });
              else setD({ ...d, sport: v, trainingId: null, title: null });
            }}
          >
            {session?.trainingId && (
              <optgroup label={sh.customTraining}>
                <option value={`training:${session.trainingId}`}>{session.title || name(session.sport)}</option>
              </optgroup>
            )}
            {WEB_SPORTS.map((w) => (
              <option key={w.key} value={w.key}>
                {name(w.key)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className={lbl}>{sh.minutes}</span>
            <input
              className={inputCls}
              inputMode="numeric"
              value={d.minutes || ""}
              onChange={(e) => setD({ ...d, minutes: Math.min(300, Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0) })}
            />
          </label>
          <label className="block min-w-0">
            <span className={lbl}>{sh.distance}</span>
            <input
              className={inputCls}
              inputMode="decimal"
              value={kmText}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 6);
                setKmText(v);
                setD({ ...d, distanceKm: parseKm(v) });
              }}
            />
          </label>
        </div>

        <div>
          <span className={lbl}>{sh.type}</span>
          <Segmented
            label={sh.type}
            value={d.type}
            options={SESSION_TYPES.map((x) => ({ value: x, label: sh.types[x] }))}
            onChange={(x) => setD(mode === "rpe" ? { ...withType(d, x), zone: null } : withType(d, x))}
          />
        </div>

        <div>
          <span className={lbl}>{sh.intensity}</span>
          <Segmented
            label={sh.intensity}
            value={mode}
            options={[
              { value: "zone", label: sh.byZone },
              { value: "rpe", label: sh.byEffort },
            ]}
            onChange={(m) => {
              setMode(m);
              setD(m === "rpe" ? { ...withZone(d, null), rpe: d.rpe ?? 5 } : { ...withZone(d, d.zone ?? 2), rpe: null });
            }}
          />
          {mode === "zone" ? (
            <div className="mt-2">
              <div role="radiogroup" aria-label={sh.byZone} className="grid grid-cols-6 gap-1">
                {[null, 1, 2, 3, 4, 5].map((z) => (
                  <button
                    key={z ?? 0}
                    type="button"
                    role="radio"
                    aria-checked={d.zone === z}
                    aria-label={z === null ? sh.noZone : [`Zone ${z}`, range(z)].filter(Boolean).join(", ")}
                    onClick={() => setD(withZone(d, z))}
                    className={cn(
                      "min-h-11 rounded-lg border border-line text-sm font-semibold",
                      d.zone === z ? "bg-volt text-ink" : "bg-surface-2 text-muted hover:text-text",
                    )}
                  >
                    {z === null ? "–" : `Z${z}`}
                  </button>
                ))}
              </div>
              {d.zone !== null && range(d.zone) && (
                <Small className="mt-1">{fmt(sh.zoneRangeHint, { n: d.zone, range: range(d.zone)! })}</Small>
              )}
            </div>
          ) : (
            <label className="mt-2 block">
              <span className="sr-only">{sh.byEffort}</span>
              <select
                className={inputCls}
                value={d.rpe ?? ""}
                onChange={(e) => setD({ ...d, rpe: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{sh.noEffort}</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {fmt(sh.effortOf, { n })}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className={lbl}>{sh.day}</span>
            <select className={inputCls} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })}>
              {(open.includes(d.date) ? open : [d.date, ...open]).map((x) => (
                <option key={x} value={x}>
                  {x === today ? s.today : dayLabel(`${x}T12:00:00`, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className={lbl}>{sh.time}</span>
            <input
              type="time"
              className={inputCls}
              value={d.slot ?? ""}
              step={300}
              aria-describedby={`${uid}-time`}
              onChange={(e) => setD({ ...d, slot: /^\d{2}:\d{2}$/.test(e.target.value) ? e.target.value : null })}
            />
            <span id={`${uid}-time`} className="sr-only">
              {sh.noTime}
            </span>
          </label>
        </div>
        {d.slot && (
          <button type="button" className="min-h-11 text-sm text-sky-fg underline" onClick={() => setD({ ...d, slot: null })}>
            {sh.noTime}
          </button>
        )}

        <label className="block">
          <span className={lbl}>{sh.note}</span>
          <textarea
            className={cn(inputCls, "h-20 resize-none py-2")}
            maxLength={200}
            value={d.memo}
            placeholder={sh.notePlaceholder}
            onChange={(e) => setD({ ...d, memo: e.target.value })}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{`🔒 ${sh.lock}`}</p>
            <Small>{sh.lockHint}</Small>
          </div>
          <Toggle on={d.locked} onChange={(v) => setD({ ...d, locked: v })} label={`${sh.lock}: ${sh.lockHint}`} />
        </div>

        <Btn type="submit" variant="volt" className="w-full" disabled={busy || (session ? !change : d.minutes < 5)}>
          {session ? sh.save : sh.saveAdd}
        </Btn>
        {session && !change && <Small className="text-center">{sh.nothing}</Small>}
      </form>

      {session && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {open.length > 0 && (
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className={lbl}>{sh.duplicateTo}</span>
                <select className={inputCls} value={dupTo} onChange={(e) => setDupTo(e.target.value)}>
                  {open.map((x) => (
                    <option key={x} value={x}>
                      {x === today ? s.today : dayLabel(`${x}T12:00:00`, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <Btn variant="ghost" className="shrink-0" disabled={busy || !dupTo} onClick={() => void run([duplicateEdit(session, dupTo)])}>
                {sh.duplicate}
              </Btn>
            </div>
          )}
          {swappable.length > 0 && (
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className={lbl}>{sh.swap}</span>
                <select className={inputCls} value={swap} onChange={(e) => setSwap(e.target.value)}>
                  {swappable.map((o) => (
                    <option key={o.id} value={o.id}>
                      {`${dayLabel(`${o.date}T12:00:00`, lang)} · ${o.title || name(o.sport)}`}
                    </option>
                  ))}
                </select>
              </label>
              <Btn
                variant="ghost"
                className="shrink-0"
                disabled={busy || !swap}
                onClick={() => void run([{ kind: "swap", a: session.id, b: swap }])}
              >
                {sh.swap}
              </Btn>
            </div>
          )}
          <Btn variant="danger" className="w-full" disabled={busy} onClick={() => void run([{ kind: "remove", session: session.id }])}>
            {sh.remove}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** The week's dates (Monday first) for the sheet's day picker. */
export const sheetDays = (monday: string) => weekDates(monday);
