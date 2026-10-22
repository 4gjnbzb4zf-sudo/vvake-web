"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { fmt, type WebAppDict } from "@/i18n/webapp";
import { cn } from "@/lib/cn";
import { ApiError, RewardsSession, errorKey, isAppCode } from "@/lib/rewardsApi";
import { webApi, type AppMe } from "@/lib/webapp/api";
import { AppProvider, TABS, useApp } from "./AppContext";
import { Onboarding, needsOnboarding } from "./Onboarding";
import { CameraScreen } from "./CameraScreen";
import { CoachScreen } from "./CoachScreen";
import { CrewScreen } from "./CrewScreen";
import { GetTheApp } from "./GetTheApp";
import { GoalsScreen } from "./GoalsScreen";
import { PlanScreen } from "./PlanScreen";
import { RhythmScreen } from "./RhythmScreen";
import { SensorScreen } from "./SensorScreen";
import { SessionScreen } from "./SessionScreen";
import { TodayScreen } from "./TodayScreen";
import { VVakerScreen } from "./VVakerScreen";
import { WorkoutScreen } from "./WorkoutScreen";
import { ZonesScreen } from "./ZonesScreen";
import { BuilderScreen, CoachProfileScreen, CreatorScreen, TrainingDetailScreen, TrainingsScreen, useTrainingRef } from "./TrainingsScreen";
import { getTrainingsDict } from "@/i18n/trainings";
import { WorkoutPill } from "./WorkoutPill";
import { YouScreen } from "./YouScreen";
import { WorkoutProvider } from "./WorkoutContext";
import { Btn, Field, inputCls, Kicker, Small } from "./ui";

/**
 * VVake on the web (vvake.com/<lang>/app): the phone app in the browser for people who don't want to install it.
 * Sign in (e-mail code, or a code from the app), the phone's onboarding for a new account, then the phone's five tabs
 * (Today, Plan, Crew & City, Coach, You) and a live GPS workout with a heart-rate strap. One static page; everything
 * live loads in the browser from the VVake API.
 */
export function WebApp({ lang, t, apiUrl, legacyTour }: { lang: Locale; t: WebAppDict; apiUrl: string; legacyTour: readonly string[] }) {
  const [session, setSession] = useState(() => new RewardsSession(apiUrl, "local"));
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [me, setMe] = useState<AppMe | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setMe(await webApi(session).me());
      setAuth("in");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth("out");
      else {
        setLoadError(true);
        setAuth("in");
      }
    }
  }, [session]);

  useEffect(() => {
    // Old links to the app's tour (/<lang>/app/#coach…, before the web app took this address) go to /<lang>/tour/.
    const old = window.location.hash.replace(/^#/, "");
    if (old && !old.startsWith("/") && legacyTour.includes(old)) {
      window.location.replace(`/${lang}/tour/#${old}`);
      return;
    }
    const id = window.setTimeout(() => {
      if (!RewardsSession.hasStored("local")) setAuth("out");
      else void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load, lang, legacyTour]);

  // The service worker keeps the app shell for the home-screen app (offline start).
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/app-sw.js", { scope: `/${lang}/app/` }).catch(() => undefined);
  }, [lang]);

  const signedOut = useCallback(() => {
    setMe(null);
    setAuth("out");
    setSession(new RewardsSession(apiUrl, "local"));
  }, [apiUrl]);

  if (auth === "checking")
    return (
      <Frame>
        <p className="mt-24 text-center text-muted" role="status">
          {t.common.loading}
        </p>
      </Frame>
    );
  if (auth === "out")
    return (
      <Frame>
        <SignInScreen
          t={t}
          lang={lang}
          session={session}
          onSignedIn={() => {
            setAuth("checking");
            void load();
          }}
        />
      </Frame>
    );
  if (!me)
    return (
      <Frame>
        <div className="mt-24 space-y-4 text-center">
          <p role="status" className="text-muted">
            {loadError ? t.common.error : t.common.loading}
          </p>
          <Btn variant="ghost" onClick={() => void load()}>
            {t.common.retry}
          </Btn>
        </div>
      </Frame>
    );
  return (
    <AppProvider lang={lang} t={t} apiUrl={apiUrl} session={session} me={me} onSignedOut={signedOut}>
      <WorkoutProvider>
        <Shell />
      </WorkoutProvider>
    </AppProvider>
  );
}

/** The page's frame: phone width, centred on a computer, safe areas on a phone. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl pt-[max(env(safe-area-inset-top),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-40 pl-[max(env(safe-area-inset-left),1rem)]">
      {children}
    </div>
  );
}

const TAB_ICONS: Record<(typeof TABS)[number], string> = { today: "☀", plan: "▦", trainings: "✚", crew: "⚑", coach: "◉", you: "●" };

function Shell() {
  const app = useApp();
  const { route, t, go, me, online } = app;
  const [onboarded, setOnboarded] = useState(() => !needsOnboarding(me));

  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />;

  const tab = route.name === "points" ? "you" : (TABS as readonly string[]).includes(route.name) ? route.name : null;
  const fullScreen = route.name === "workout" || route.name === "camera" || route.name === "train" || route.name === "teach";
  return (
    <>
      {!fullScreen && (
        <Frame>
          {!online && (
            <p role="status" className="mb-3 rounded-xl border border-butter-fg/40 bg-surface px-3 py-2 text-sm text-butter-fg">
              {t.common.offline}
            </p>
          )}
          <main id="main">
            {route.name === "today" && <TodayScreen />}
            {route.name === "plan" && <PlanScreen />}
            {route.name === "crew" && <CrewScreen />}
            {route.name === "coach" && <CoachScreen />}
            {route.name === "you" && <YouScreen />}
            {route.name === "points" && <YouScreen focus="points" />}
            {route.name === "goals" && <GoalsScreen />}
            {route.name === "rhythm" && <RhythmScreen />}
            {route.name === "vvaker" && <VVakerScreen />}
            {route.name === "sensor" && <SensorScreen />}
            {route.name === "zones" && <ZonesScreen />}
            {route.name === "session" && <SessionScreen id={route.id} />}
            {route.name === "trainings" && <TrainingsScreen />}
            {route.name === "training" && <TrainingDetailScreen key={route.ref} refId={route.ref} challenge={route.challenge} />}
            {route.name === "build" && <BuilderScreen key={route.id ?? "new"} id={route.id} />}
            {route.name === "coach-profile" && <CoachProfileScreen />}
            {route.name === "creator" && <CreatorScreen key={route.handle} handle={route.handle} />}
          </main>
        </Frame>
      )}
      {route.name === "workout" && <WorkoutScreen />}
      {route.name === "camera" && <CameraScreen sport={route.sport} />}
      {route.name === "train" && <TrainingRun key={route.ref} refId={route.ref} challenge={route.challenge} />}
      {route.name === "teach" && <CameraScreen teach />}
      {!fullScreen && <WorkoutPill />}
      {!fullScreen && (
        <nav
          aria-label="VVake"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night-2/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur"
        >
          <ul className="mx-auto flex max-w-xl">
            {TABS.map((k) => (
              <li key={k} className="flex-1">
                <button
                  type="button"
                  onClick={() => go({ name: k })}
                  aria-current={tab === k ? "page" : undefined}
                  className={cn(
                    "flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                    tab === k ? "text-volt-fg" : "text-faint hover:text-text",
                  )}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {TAB_ICONS[k]}
                  </span>
                  {t.tabs[k]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

/** #/train/<code or id>(/<challenge>): the training loaded, then the camera workout running it (ADR-0047). */
function TrainingRun({ refId, challenge }: { refId: string; challenge?: string }) {
  const { lang, go } = useApp();
  const state = useTrainingRef(refId);
  const r = getTrainingsDict(lang).app.run;
  if (state.kind === "ready")
    return <CameraScreen training={{ training: state.shared.training, code: state.shared.code, challenge: challenge ?? null }} />;
  return (
    <Frame>
      <div className="mt-24 space-y-4 text-center">
        <p role="status" className="text-muted">
          {state.kind === "loading" ? r.loading : r.notFound}
        </p>
        {state.kind === "missing" && (
          <Btn variant="ghost" onClick={() => go({ name: "trainings" })}>
            {getTrainingsDict(lang).app.title}
          </Btn>
        )}
      </div>
    </Frame>
  );
}

function SignInScreen({ t, lang, session, onSignedIn }: { t: WebAppDict; lang: Locale; session: RewardsSession; onSignedIn: () => void }) {
  const s = t.signIn;
  const [tab, setTab] = useState<"email" | "app">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [appCode, setAppCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      const k = errorKey(e);
      setMsg(k in s.errors ? s.errors[k as keyof typeof s.errors] : s.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  const onEmail = (ev: FormEvent) => {
    ev.preventDefault();
    if (!sentTo) {
      const to = email.trim();
      void run(async () => {
        await session.startEmail(to);
        setSentTo(to);
      });
    } else
      void run(async () => {
        await session.verifyEmail(sentTo, code.trim());
        onSignedIn();
      });
  };
  const onApp = (ev: FormEvent) => {
    ev.preventDefault();
    void run(async () => {
      await session.redeemAppCode(appCode);
      onSignedIn();
    });
  };

  return (
    <div className="pt-6">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Kicker tone="pulse">{s.kicker}</Kicker>
          <h1 className="mt-2 font-display text-3xl leading-tight font-bold">{s.title}</h1>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/personas/runner.webp" alt="" className="h-28 w-auto object-contain" />
      </div>
      <p className="mt-3 text-muted">{s.lead}</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <div role="tablist" className="flex gap-1 rounded-xl border border-line p-1">
          {(["email", "app"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("min-h-11 flex-1 rounded-lg text-sm font-semibold", tab === k ? "bg-surface-2 text-text" : "text-muted")}
            >
              {k === "email" ? s.emailTab : s.appTab}
            </button>
          ))}
        </div>
        {tab === "email" ? (
          <form className="mt-4 space-y-3" onSubmit={onEmail}>
            {!sentTo ? (
              <Field label={s.email} hint={s.emailHint}>
                <input
                  className={inputCls}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder={s.emailPlaceholder}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <p className="text-sm">{fmt(s.codeSent, { email: sentTo })}</p>
                <Field label={s.code}>
                  <input
                    className={cn(inputCls, "tracking-[0.3em]")}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </>
            )}
            <Btn type="submit" big className="w-full" disabled={busy}>
              {sentTo ? s.verify : s.sendCode}
            </Btn>
            {sentTo && (
              <button type="button" className="w-full py-2 text-sm text-muted underline" onClick={() => (setSentTo(null), setCode(""))}>
                {s.otherEmail}
              </button>
            )}
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={onApp}>
            <Field label={s.appCode} hint={s.appHint}>
              <input
                className={cn(inputCls, "tracking-[0.3em] uppercase")}
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={9}
                required
                value={appCode}
                placeholder={s.appCodePlaceholder}
                onChange={(e) => setAppCode(e.target.value)}
              />
            </Field>
            <Small className="text-butter-fg">{s.appWarning}</Small>
            <Btn type="submit" big className="w-full" disabled={busy || !isAppCode(appCode)}>
              {s.verify}
            </Btn>
          </form>
        )}
        {msg && (
          <p role="alert" className="mt-3 text-sm text-down-fg">
            {msg}
          </p>
        )}
      </div>
      <Small className="mt-4">{s.stay}</Small>
      <Small className="mt-2">
        {s.terms}{" "}
        <a className="underline" href={`/${lang}/terms/`}>
          {s.termsLink}
        </a>{" "}
        ·{" "}
        <a className="underline" href={`/${lang}/privacy/`}>
          {s.privacyLink}
        </a>
      </Small>
      <GetTheApp t={t} className="mt-6" />
      <p className="mt-8 text-center text-sm">
        <a className="text-muted underline" href={`/${lang}/`}>
          {t.common.site}
        </a>
      </p>
    </div>
  );
}
