"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { buttonClass, inputClass } from "@/components/ui/Button";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { FreeEntry, SkillQuestion } from "@/lib/rewardsApi";

type Dict = Dictionary["rewards"];

/** Both ways in use this exact card: Plus and the free entry carry equal weight on the page (ADR-0024, no purchase necessary). */
const WAY_CARD = "flex flex-col rounded-2xl border border-line bg-surface/60 p-6";

/**
 * "Two ways in, same prize": VVake Fit Plus or the free entry (POST / DELETE /v1/rewards/entry), side by side and
 * styled alike. Signed out, it shows the rule and asks to sign in; signed in, the free entry is one tap.
 */
export function EntryChoice({
  dict,
  signedIn,
  entry,
  plusActive,
  busy,
  msg,
  date,
  onEnter,
  onWithdraw,
}: {
  dict: Dict["entry"];
  signedIn: boolean;
  /** GET /v1/rewards `entry`; undefined when signed out or from an older API. */
  entry?: { plus: boolean; free: FreeEntry | null } | null;
  /** Any Plus (paid or beta): beta Plus alone isn't an entry. */
  plusActive: boolean;
  busy: boolean;
  msg: string | null;
  date: (iso: string) => string;
  onEnter: () => void;
  onWithdraw: () => void;
}) {
  const free = entry?.free ?? null;
  const plusLine = !signedIn ? null : entry?.plus ? dict.plus.on : plusActive ? dict.plus.beta : dict.plus.off;
  return (
    <div className="mt-10" data-testid="entry-choice">
      <h3 className="font-display text-xl font-semibold">{dict.title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{dict.lead}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Way kind="plus" kicker={dict.plus.kicker} title={dict.plus.title} body={dict.plus.body}>
          {plusLine && <p className={cn("mt-4 text-sm", entry?.plus ? "text-up-fg" : "text-faint")}>{plusLine}</p>}
        </Way>
        <Way kind="free" kicker={dict.free.kicker} title={dict.free.title} body={dict.free.body}>
          {!signedIn ? (
            <p className="mt-4 text-sm text-faint">{dict.free.signIn}</p>
          ) : free ? (
            <>
              <p className="mt-4 text-sm text-up-fg" role="status">
                {dict.free.on}
              </p>
              <p className="mt-1 text-sm text-muted">{format(dict.free.countsFrom, { date: date(free.countsFrom) })}</p>
              <button type="button" className={cn(buttonClass("ghost"), "mt-4 self-start")} disabled={busy} onClick={onWithdraw}>
                {dict.free.withdraw}
              </button>
            </>
          ) : (
            <button type="button" className={cn(buttonClass("primary"), "mt-4 self-start")} disabled={busy} onClick={onEnter}>
              {dict.free.enter}
            </button>
          )}
        </Way>
      </div>
      {msg && (
        <p className="mt-4 text-sm text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

function Way({
  kind,
  kicker,
  title,
  body,
  children,
}: {
  kind: "plus" | "free";
  kicker: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className={WAY_CARD} data-way={kind}>
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{kicker}</p>
      <p className="mt-2 font-display text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {children}
    </div>
  );
}

/**
 * This week's skill-testing question (GET / POST /v1/rewards/skill): plain arithmetic, required by Canadian law
 * before a prize. `skill` undefined = loading, null = can't be loaded.
 */
export function SkillCard({
  dict,
  skill,
  busy,
  msg,
  date,
  onAnswer,
}: {
  dict: Dict["skill"];
  skill: SkillQuestion | null | undefined;
  busy: boolean;
  msg: string | null;
  date: (iso: string) => string;
  onAnswer: (answer: number) => void;
}) {
  const [answer, setAnswer] = useState("");
  const value = /^-?\d{1,6}$/.test(answer.trim()) ? Number(answer.trim()) : null;
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (value === null) return;
    onAnswer(value);
    setAnswer("");
  };
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-6" data-testid="skill-card">
      <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.title}</p>
      {skill === undefined ? (
        <p className="mt-3 text-sm text-muted">{dict.loading}</p>
      ) : skill === null ? (
        <p className="mt-3 text-sm text-muted">{dict.unavailable}</p>
      ) : skill.answered ? (
        <p className="mt-3 text-sm text-up-fg" role="status">
          {format(dict.done, { date: skill.answeredAt ? date(skill.answeredAt) : "" })}
        </p>
      ) : skill.attemptsLeft <= 0 || !skill.question ? (
        <p className="mt-3 text-sm text-butter-fg" role="status">
          {dict.none}
        </p>
      ) : (
        <form className="mt-3" onSubmit={submit}>
          <label htmlFor="skill-answer" className="block font-display text-2xl font-semibold tabular-nums">
            {skill.question} = ?
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              id="skill-answer"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              aria-label={dict.label}
              placeholder={dict.label}
              className={cn(inputClass, "max-w-40 font-mono")}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))}
            />
            <button type="submit" className={buttonClass("primary")} disabled={busy || value === null}>
              {dict.submit}
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">{format(dict.tries, { n: skill.attemptsLeft })}</p>
        </form>
      )}
      {msg && (
        <p className="mt-3 text-sm text-butter-fg" role="status">
          {msg}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-faint">{dict.why}</p>
    </div>
  );
}

/**
 * One prize in the claim list. `opensAt` (formatted) set = the week's root is on chain but claims open later
 * (contracts v2: 48 h after posting): the claim button stays disabled and says from when.
 */
export function ClaimItem({
  dict,
  e,
  title,
  opensAt,
  disabled,
  onClaim,
  children,
}: {
  dict: Dict["claim"];
  e: { epoch: number };
  title: string;
  opensAt: string | null;
  disabled: boolean;
  onClaim: () => void;
  children?: ReactNode;
}) {
  return (
    <li
      data-epoch={e.epoch}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-display font-semibold">{title}</p>
        {opensAt && <p className="mt-1 text-sm text-butter-fg">{format(dict.opensAt, { date: opensAt })}</p>}
        {children}
      </div>
      <button type="button" className={buttonClass("primary")} disabled={disabled || opensAt !== null} onClick={onClaim}>
        {dict.one}
      </button>
    </li>
  );
}
