"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiSession } from "@/lib/webapp/api";
import { sourcesLine, vehicleLine } from "@/lib/webapp/vehicle/journal";
import { clock, dayLabel, distance } from "@/lib/webapp/format";
import { coachVoiceGender, type CoachVoiceGender } from "@/lib/coachVoices";
import { WORKOUT_VOICE_MODES } from "@/lib/webapp/speedZones";
import { weekPoints } from "@/lib/webapp/points";
import { sportLabel, streakMultiplier } from "@/lib/webapp/workout";
import { ownPlanName } from "@/lib/coachPlus";
import { useApp } from "./AppContext";
import { GetTheApp } from "./GetTheApp";
import { VVakerImg } from "./MyVVaker";
import { Btn, Card, Field, H1, H2, inputCls, Kicker, List, Row, Segmented, Small } from "./ui";
import { useNow } from "./useNow";
import { BetterVoice, VoiceSources } from "./VoiceTip";
import { CoachVoicePicker } from "./CoachVoicePicker";
import { TailorDevCard } from "./TailorScreen";
import { ReplayTours, SuggestPicker } from "./Suggest";
import { getTailorDict } from "@/i18n/tailor";
import { getTalkDict } from "@/i18n/talk";
import { getNutritionDict } from "@/i18n/nutrition";
import { packOn, tailorText, TAILOR_FEATURES, TAILOR_PRESET_TEXT } from "@/lib/webapp/tailor/tailor";

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
    profile,
    suggests,
    featureOn,
  } = useApp();
  const lean = getTailorDict(lang);
  const [settingsOpen, setSettingsOpen] = useState(focus !== undefined && focus !== "points" && focus !== "progress");
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
  const voiceGender = coachVoiceGender(me.coach?.voiceGender);
  const [voiceError, setVoiceError] = useState(false);
  /** Coach voice: shown at once, saved on the account (the phone and the watches read it from there). */
  const saveVoiceGender = async (g: CoachVoiceGender) => {
    if (g === voiceGender) return;
    const before = me;
    setVoiceError(false);
    setMe({ ...me, coach: { ...me.coach, voiceGender: g } });
    try {
      setMe(await api.patchMe({ coach: { voiceGender: g } }));
    } catch {
      setMe(before);
      setVoiceError(true);
    }
  };
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

  const header = (
    <div id={sectionId("profile")} className="flex items-center gap-4">
      <button type="button" onClick={() => go({ name: "vvaker" })} aria-label={t.today.vvakerRow}>
        <VVakerImg alt="" className="h-24 w-16" />
      </button>
      <div className="min-w-0">
        <H1>{me.name || t.you.title}</H1>
        {me.email && <Small>{fmt(t.you.signedInAs, { name: me.email })}</Small>}
      </div>
    </div>
  );

  const profileCard = (
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
  );

  const statsCard = stats && (
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
  );

  const history = (
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
              detail={[
                `${dayLabel(s.startedAt, lang)} · ${clock(s.activeS)}${s.distanceM ? ` · ${distance(s.distanceM, prefs.units, lang)}` : ""}`,
                // Build 58: a workout in parts (phone · watch) and a vehicle stretch, said plainly.
                sourcesLine(s, t.workout, fmt),
                vehicleLine(s, t.workout, fmt),
              ]
                .filter(Boolean)
                .join(" · ")}
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
  );

  const devices = (
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
  );

  // What your coach remembers (ADR-0068): see, correct, delete; and the Health numbers you corrected.
  const coachList = (
    <List>
      <Row
        tone="lilac"
        icon="◉"
        title={getTalkDict(lang).memory.row}
        detail={getTalkDict(lang).memory.rowLead}
        onClick={() => go({ name: "coach-memory" })}
      />
    </List>
  );

  const sportsList = (
    <List>
      <Row tone="sky" icon="⏲" title={t.you.speedZones} detail={t.you.speedZonesDetail} onClick={() => go({ name: "zones" })} />
      {packOn(profile, "plan") && <Row tone="volt" icon="◎" title={t.goals.title} onClick={() => go({ name: "goals" })} />}
    </List>
  );

  const habitsList = (
    <List>
      <Row tone="sky" icon="💧" title={t.rhythm.title} onClick={() => go({ name: "rhythm" })} />
    </List>
  );

  // Nutrition (ADR-0070, optional): only once turned on; otherwise it lives in All features, never pushed here.
  const tnu = getNutritionDict(lang);
  const nutritionList = featureOn("nutrition") ? (
    <List>
      <Row tone="mint" icon="🍽" title={tnu.title} detail={tnu.lead} onClick={() => go({ name: "nutrition" })} />
    </List>
  ) : null;

  /* VV points explained: this week's from the loaded history, the streak bonus, how points work. Points only. */
  const pointsCard = (
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
      {(!profile || profile.rewardsVisible) && (
        <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-fg underline" href={`/${lang}/rewards/`}>
          {t.you.pointsPrizes}
        </a>
      )}
    </Card>
  );

  const appCard = (
    <Card>
      {packOn(profile, "coach") && (
        <>
          <H2>{t.you.voice}</H2>
          <Small>{t.you.voiceDetail}</Small>
          <div className="mt-3">
            <CoachVoicePicker value={voiceGender} onChange={(g) => void saveVoiceGender(g)} />
            {voiceError && (
              <p role="alert" className="mt-1 text-xs text-down-fg">
                {t.you.coachVoiceError}
              </p>
            )}
          </div>
        </>
      )}
      <div className="mt-4 first:mt-0">
        <p className="mb-1 text-sm font-medium">{t.you.duringWorkouts}</p>
        <Segmented
          label={t.you.duringWorkouts}
          value={workoutVoice}
          options={WORKOUT_VOICE_MODES.map((k) => ({ value: k, label: t.you.workoutVoice[k] }))}
          onChange={(v) => setWorkoutVoice(v)}
        />
        <Small className="mt-1">{t.you.duringWorkoutsDetail}</Small>
      </div>
      {packOn(profile, "coach") && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">{t.you.chattinessTitle}</p>
          <Segmented
            label={t.you.chattinessTitle}
            value={prefs.chattiness}
            options={(["quiet", "normal", "chatty"] as const).map((k) => ({ value: k, label: t.you.chattiness[k] }))}
            onChange={(v) => setPrefs({ chattiness: v })}
          />
        </div>
      )}
      <VoiceSources />
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
      <SuggestPicker className="mt-4" />
      <ReplayTours className="mt-4" />
    </Card>
  );

  const accountRows = (
    <List>
      <Row
        tone="sky"
        icon="⚙"
        title={t.you.settings}
        detail={fmt(t.you.settingsDetail, { plan: ownPlanName(me) })}
        href={`/${lang}/account/`}
      />
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
  );

  const privacy = (
    <List>
      <Row tone="faint" icon="🔒" title={t.you.privacy} href={`/${lang}/privacy/#web-app`} />
    </List>
  );

  const appOnly = (
    <Card>
      <H2>{t.you.appOnlyTitle}</H2>
      <Small className="mt-1">{t.you.appOnlyLead}</Small>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {t.you.appOnly.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {suggests("you_might_like") && <GetTheApp t={t} compact className="mt-4" />}
    </Card>
  );

  const signOutBtn = (
    <Btn variant="danger" className="w-full" onClick={signOut}>
      {t.you.signOut}
    </Btn>
  );

  // "Your VVake" on (ADR-0059, lean doc §5.3): results first (you, numbers, points, history), then Your VVake, All
  // features and one Settings row that opens every setting; a feature that is off keeps its settings in All features.
  if (profile) {
    const L = lang === "fr" ? "fr" : "en";
    const on = TAILOR_FEATURES.filter((k) => profile.features[k]).length;
    return (
      <div className="space-y-5">
        {header}
        {statsCard}
        <div id={sectionId("points")}>{pointsCard}</div>
        {history}
        <WaysToTrain />
        <List>
          <Row
            tone="volt"
            icon="✦"
            title={tailorText("tailor.title", L)}
            detail={fmt(lean.you.yourVVakeDetail, { preset: TAILOR_PRESET_TEXT[profile.preset][L] })}
            onClick={() => go({ name: "your-vvake" })}
          />
          <Row
            tone="sky"
            icon="▦"
            title={lean.you.allFeatures}
            detail={fmt(lean.you.allFeaturesDetail, { on, off: TAILOR_FEATURES.length - on })}
            onClick={() => go({ name: "features" })}
          />
          <button
            type="button"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2/60"
          >
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-base text-sky-fg">
              ⚙
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{settingsOpen ? lean.you.hide : lean.you.settings}</span>
              <span className="block truncate text-xs text-muted">{lean.you.settingsDetail}</span>
            </span>
            <span aria-hidden className="text-faint">
              {settingsOpen ? "⌃" : "›"}
            </span>
          </button>
        </List>
        {settingsOpen && (
          <div className="space-y-5">
            {profileCard}
            {devices}
            {sportsList}
            {coachList}
            {packOn(profile, "habits") && habitsList}
            {nutritionList}
            {appCard}
            {accountRows}
            {privacy}
            {appOnly}
          </div>
        )}
        <TailorDevCard />
        {signOutBtn}
      </div>
    );
  }

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

      {header}
      {profileCard}

      <SectionTitle id={sectionId("progress")}>{t.you.sections.progress}</SectionTitle>
      {statsCard}
      {history}

      <SectionTitle id={sectionId("devices")}>{t.you.sections.devices}</SectionTitle>
      {devices}

      <SectionTitle id={sectionId("sports")}>{t.you.sections.sports}</SectionTitle>
      {sportsList}

      <SectionTitle id={sectionId("habits")}>{t.you.sections.habits}</SectionTitle>
      {habitsList}
      {nutritionList}

      <SectionTitle id={sectionId("points")}>{t.you.sections.points}</SectionTitle>
      {pointsCard}

      <SectionTitle id={sectionId("app")}>{t.you.sections.app}</SectionTitle>
      {appCard}
      {accountRows}

      <SectionTitle id={sectionId("privacy")}>{t.you.sections.privacy}</SectionTitle>
      {privacy}

      {appOnly}
      <TailorDevCard />
      {signOutBtn}
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

/** Ways to train (build 54): GPS & sensor and camera workouts on Today, never both hidden (the tailored You). */
function WaysToTrain() {
  const { lang, ways, canHideWay, setWay, featureOn } = useApp();
  const x = getTailorDict(lang).today;
  if (!featureOn("camera")) return null;
  const row = (w: "gps" | "camera", title: string, detail?: string) => {
    const on = ways[w];
    return (
      <label className="flex min-h-14 items-center gap-3 px-4 py-2">
        <span className="flex-1">
          <span className="block font-display font-semibold">{title}</span>
          {detail && <span className="block text-sm text-muted">{detail}</span>}
        </span>
        <input
          type="checkbox"
          role="switch"
          className="h-5 w-5"
          checked={on}
          disabled={on && !canHideWay(w)}
          onChange={(e) => setWay(w, e.target.checked)}
        />
      </label>
    );
  };
  return (
    <section aria-label={x.waysTitle} className="space-y-2">
      <Kicker>{x.waysTitle}</Kicker>
      <List>
        {row("gps", x.waysGpsRow, x.waysGpsDetail)}
        {row("camera", x.waysCameraRow)}
      </List>
      <Small>{x.waysHint}</Small>
    </section>
  );
}
