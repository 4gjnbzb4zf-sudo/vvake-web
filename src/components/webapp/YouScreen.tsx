"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiSession } from "@/lib/webapp/api";
import { clock, dayLabel, distance } from "@/lib/webapp/format";
import { previewVoice, unlockAudio } from "@/lib/webapp/coachAudio";
import { WORKOUT_VOICE_MODES } from "@/lib/webapp/speedZones";
import { weekPoints } from "@/lib/webapp/points";
import { sportLabel, streakMultiplier } from "@/lib/webapp/workout";
import { useApp } from "./AppContext";
import { GetTheApp } from "./GetTheApp";
import { VVakerImg } from "./MyVVaker";
import { Btn, Card, Field, H1, H2, inputCls, Kicker, List, Row, Segmented, Small } from "./ui";
import { useNow } from "./useNow";
import { BetterVoice } from "./VoiceTip";

/** The section index at the top of You (the phone's You index), in page order. */
const SECTIONS = ["profile", "progress", "devices", "sports", "habits", "points", "app", "privacy"] as const;
type Section = (typeof SECTIONS)[number];
const sectionId = (k: Section) => `you-${k}`;

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

/**
 * You (apps/mobile app/(tabs)/you.tsx): your VVaker and profile, your numbers, history, the heart-rate sensor, the
 * voice coach and units on this browser, every other setting on the account page, add to home screen, what only the
 * app can do, sign out. A section index on top; VV points explained (#/points opens You on that card).
 */
export function YouScreen({ focus }: { focus?: Section } = {}) {
  const {
    t,
    lang,
    me,
    setMe,
    api,
    stats,
    streak,
    sessions,
    prefs,
    setPrefs,
    go,
    signOut,
    sensorState,
    bpm,
    fmt,
    workoutVoice,
    setWorkoutVoice,
  } = useApp();
  const now = useNow();
  const vv = useMemo(() => weekPoints(sessions, now), [sessions, now]);
  const days = streak?.days ?? stats?.streakDays ?? 0;
  const mult = streak?.multiplier ?? streakMultiplier(days);
  const jump = (k: Section) => document.getElementById(sectionId(k))?.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => {
    if (!focus) return;
    const id = window.setTimeout(() => document.getElementById(sectionId(focus))?.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(id);
  }, [focus]);
  const [name, setName] = useState(me.name ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hearing, setHearing] = useState<"coach" | "device" | null>(null);
  const [more, setMore] = useState<ApiSession[]>([]);
  const [nextLoaded, setNext] = useState<string | null | undefined>(undefined);
  const next = nextLoaded !== undefined ? nextLoaded : sessions.length >= 30 ? sessions[sessions.length - 1]!.startedAt : null;
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setStandalone(
        window.matchMedia?.("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
      setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }, 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const saveProfile = async () => {
    setSaved("saving");
    try {
      setMe(await api.patchMe({ name: name.trim().slice(0, 80), city: city.trim() ? city.trim().slice(0, 80) : null }));
      setSaved("saved");
    } catch {
      setSaved("error");
    }
  };
  const loadMore = async () => {
    if (!next) return;
    try {
      const r = await api.sessions(next);
      setMore((x) => [...x, ...r.sessions]);
      setNext(r.next ?? null);
    } catch {
      // try again later
    }
  };
  const all = [...sessions, ...more];
  const period = (k: "week" | "month" | "all") => stats?.[k];

  return (
    <div className="space-y-5">
      <nav aria-label={t.you.index}>
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => jump(k)}
                className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-text hover:border-muted/60"
              >
                {t.you.sections[k]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div id={sectionId("profile")} className="flex items-center gap-4">
        <button type="button" onClick={() => go({ name: "vvaker" })} aria-label={t.today.vvakerRow}>
          <VVakerImg alt="" className="h-24 w-16" />
        </button>
        <div className="min-w-0">
          <H1>{me.name || t.you.title}</H1>
          {me.email && <Small>{fmt(t.you.signedInAs, { name: me.email })}</Small>}
        </div>
      </div>

      <Card>
        <H2>{t.you.profile}</H2>
        <div className="mt-3 space-y-3">
          <Field label={t.you.name}>
            <input className={inputCls} value={name} maxLength={80} onChange={(e) => (setName(e.target.value), setSaved("idle"))} />
          </Field>
          <Field label={t.you.city} hint={t.onboarding.name.cityHint}>
            <input className={inputCls} value={city} maxLength={80} onChange={(e) => (setCity(e.target.value), setSaved("idle"))} />
          </Field>
          <div className="flex items-center gap-3">
            <Btn variant="volt" disabled={saved === "saving" || !name.trim()} onClick={() => void saveProfile()}>
              {saved === "saving" ? t.common.saving : t.common.save}
            </Btn>
            {saved === "saved" && <Small className="text-up-fg">{t.common.saved}</Small>}
            {saved === "error" && <Small className="text-down-fg">{t.common.error}</Small>}
          </div>
        </div>
      </Card>

      <SectionTitle id={sectionId("progress")}>{t.you.sections.progress}</SectionTitle>
      {stats && (
        <Card>
          <H2>{t.you.stats}</H2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(["week", "month", "all"] as const).map((k) => (
              <div key={k} className="rounded-xl bg-surface-2 p-2">
                <Kicker>{k === "week" ? t.you.weekShort : k === "month" ? t.you.monthShort : t.you.allShort}</Kicker>
                <p className="mt-1 font-display text-xl font-bold">{period(k)?.sessions ?? 0}</p>
                <Small>{t.you.sessions}</Small>
                <p className="mt-1 text-sm font-semibold">{period(k)?.activeMin ?? 0}</p>
                <Small>{t.you.active}</Small>
                <p className="mt-1 text-sm font-semibold">{distance(period(k)?.distanceM ?? 0, prefs.units, lang)}</p>
              </div>
            ))}
          </div>
          {stats.best && (stats.best.longestM || stats.best.fastestKmS) ? (
            <p className="mt-3 text-sm text-muted">
              {t.you.best}: {stats.best.longestM ? `${t.you.longest} ${distance(stats.best.longestM, prefs.units, lang)}` : ""}
              {stats.best.fastestKmS ? ` · ${t.you.fastest} ${clock(stats.best.fastestKmS)}` : ""}
            </p>
          ) : null}
        </Card>
      )}

      <section className="space-y-2">
        <H2>{t.you.history}</H2>
        {all.length === 0 ? (
          <Small>{t.you.noHistory}</Small>
        ) : (
          <List>
            {all.map((s) => (
              <Row
                key={s.id}
                tone={s.source === "web" ? "sky" : s.source === "watch" ? "pulse" : "volt"}
                icon={s.source === "web" ? "⌘" : s.source === "watch" ? "⌚" : "▲"}
                title={sportLabel(s.sport, lang)}
                detail={`${dayLabel(s.startedAt, lang)} · ${clock(s.activeS)}${s.distanceM ? ` · ${distance(s.distanceM, prefs.units, lang)}` : ""}`}
                value={typeof s.points === "number" ? fmt(t.workout.points, { n: s.points }) : undefined}
                onClick={() => go({ name: "session", id: s.id })}
              />
            ))}
          </List>
        )}
        {next && (
          <Btn variant="ghost" className="w-full" onClick={() => void loadMore()}>
            {t.you.loadMore}
          </Btn>
        )}
      </section>

      <SectionTitle id={sectionId("devices")}>{t.you.sections.devices}</SectionTitle>
      <List>
        <Row
          tone="mint"
          icon="♥"
          title={t.you.heart}
          detail={
            sensorState === "connected" && bpm
              ? fmt(t.sensor.bpm, { n: bpm })
              : sensorState === "idle"
                ? t.sensor.connect
                : t.sensor[sensorState]
          }
          onClick={() => go({ name: "sensor" })}
        />
      </List>

      <SectionTitle id={sectionId("sports")}>{t.you.sections.sports}</SectionTitle>
      <List>
        <Row tone="sky" icon="⏲" title={t.you.speedZones} detail={t.you.speedZonesDetail} onClick={() => go({ name: "zones" })} />
        <Row tone="volt" icon="◎" title={t.goals.title} onClick={() => go({ name: "goals" })} />
      </List>

      <SectionTitle id={sectionId("habits")}>{t.you.sections.habits}</SectionTitle>
      <List>
        <Row tone="sky" icon="💧" title={t.rhythm.title} onClick={() => go({ name: "rhythm" })} />
      </List>

      {/* VV points explained: this week's from the loaded history, the streak bonus, how points work. Points only. */}
      <SectionTitle id={sectionId("points")}>{t.you.sections.points}</SectionTitle>
      <Card>
        <Kicker tone="mint">{t.you.pointsTitle}</Kicker>
        <p className="mt-2 font-display text-xl font-bold">{vv.points > 0 ? fmt(t.you.pointsWeek, { n: vv.points }) : t.you.pointsNone}</p>
        {vv.points > 0 && <Small className="mt-1">{fmt(t.you.pointsWeekFrom, { n: vv.counted, bonus: vv.bonus })}</Small>}
        <p className="mt-3 text-sm">{days > 0 ? fmt(t.you.pointsStreak, { n: days, m: mult }) : t.you.pointsStreakNone}</p>
        <h3 className="mt-4 text-sm font-semibold">{t.you.pointsHowTitle}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {t.you.pointsHow.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-fg underline" href={`/${lang}/rewards/`}>
          {t.you.pointsPrizes}
        </a>
      </Card>

      <SectionTitle id={sectionId("app")}>{t.you.sections.app}</SectionTitle>
      <Card>
        <H2>{t.you.voice}</H2>
        <Small>{t.you.voiceDetail}</Small>
        <div className="mt-3">
          <p className="mb-1 text-sm font-medium">{t.you.duringWorkouts}</p>
          <Segmented
            label={t.you.duringWorkouts}
            value={workoutVoice}
            options={WORKOUT_VOICE_MODES.map((k) => ({ value: k, label: t.you.workoutVoice[k] }))}
            onChange={(v) => setWorkoutVoice(v)}
          />
          <Small className="mt-1">{t.you.duringWorkoutsDetail}</Small>
        </div>
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">{t.you.chattinessTitle}</p>
          <Segmented
            label={t.you.chattinessTitle}
            value={prefs.chattiness}
            options={(["quiet", "normal", "chatty"] as const).map((k) => ({ value: k, label: t.you.chattiness[k] }))}
            onChange={(v) => setPrefs({ chattiness: v })}
          />
        </div>
        <div className="mt-4">
          <Btn
            variant="ghost"
            onClick={() => {
              // The tap unlocks the page's audio (Safari), then the preview plays in the voice every line uses.
              unlockAudio();
              setHearing(null);
              previewVoice(setHearing);
            }}
          >
            {t.you.hearCoach}
          </Btn>
          <Small className="mt-1">
            {hearing === "coach" ? t.you.hearingCoach : hearing === "device" ? t.you.hearingDevice : t.you.hearCoachDetail}
          </Small>
        </div>
        <BetterVoice />
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">{t.you.units}</p>
          <Segmented
            label={t.you.units}
            value={prefs.units}
            options={[
              { value: "metric", label: t.you.metric },
              { value: "imperial", label: t.you.imperial },
            ]}
            onChange={(v) => setPrefs({ units: v })}
          />
        </div>
      </Card>

      <List>
        <Row tone="sky" icon="⚙" title={t.you.settings} detail={t.you.settingsDetail} href={`/${lang}/account/`} />
        {!standalone && (install || ios) && (
          <Row
            tone="volt"
            icon="⊕"
            title={t.you.install}
            detail={install ? t.you.installDetail : t.you.installIos}
            onClick={install ? () => void install.prompt().then(() => setInstall(null)) : undefined}
          />
        )}
      </List>

      <SectionTitle id={sectionId("privacy")}>{t.you.sections.privacy}</SectionTitle>
      <List>
        <Row tone="faint" icon="🔒" title={t.you.privacy} href={`/${lang}/privacy/#web-app`} />
      </List>

      <Card>
        <H2>{t.you.appOnlyTitle}</H2>
        <Small className="mt-1">{t.you.appOnlyLead}</Small>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {t.you.appOnly.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <GetTheApp t={t} compact className="mt-4" />
      </Card>

      <Btn variant="danger" className="w-full" onClick={signOut}>
        {t.you.signOut}
      </Btn>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="pt-2">
      <H2>{children}</H2>
    </div>
  );
}
