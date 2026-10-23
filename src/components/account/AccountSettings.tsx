"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { coachPlusActive } from "@/lib/coachPlus";
import { SignIn } from "@/components/rewards/RewardsAccount";
import { buttonClass } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AccountDict } from "@/i18n/account";
import { accountApi, connectNotice, withoutConnectParams, type ConnectNotice, type Me } from "@/lib/accountApi";
import { visitorDatePrefs } from "@/lib/dates";
import { rememberPlus } from "@/lib/plusPay";
import { ApiError, errorKey, RewardsSession } from "@/lib/rewardsApi";
import { cn } from "@/lib/cn";
import { AppSection, ProfileSection, RemindersSection } from "./ProfilePanels";
import { CoachSection, HealthSection, GoalsSection, PlanSection } from "./CoachPanels";
import { ConnectionsSection, DataSection, PlusSection, PulseSection } from "./ConnectionPanels";
import { ACCOUNT_SECTIONS, sectionIndex, type PanelProps } from "./shared";
import { ZonesSection } from "./ZonesPanel";

/**
 * vvake.com/account: sign in (the rewards page's e-mail code or app link code), then every setting the account keeps.
 * Each panel loads its own data, so a route an older API lacks only hides that panel's part.
 */
export function AccountSettings({ dict, t, lang, apiUrl }: { dict: Dictionary["rewards"]; t: AccountDict; lang: Locale; apiUrl: string }) {
  const [session] = useState(() => new RewardsSession(apiUrl));
  const api = useMemo(() => accountApi(session), [session]);
  const [auth, setAuth] = useState<"checking" | "out" | "in">("checking");
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ConnectNotice | null>(null);
  const [gone, setGone] = useState(false);

  const errorMsg = useCallback(
    (e: unknown) => {
      const k = errorKey(e);
      if (k === "network" || k === "tooMany" || k === "expired") return dict.errors[k];
      return t.error;
    },
    [dict.errors, t.error],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const m = await api.me();
      setMe(m);
      rememberPlus(coachPlusActive(m) ? (m.plusUntil ?? null) : null);
      setAuth("in");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuth("out");
        return;
      }
      setLoadError(errorMsg(e));
      setAuth("in");
    }
  }, [api, errorMsg]);

  // Back from a reload or an OAuth redirect: the refresh token in this tab signs you in again.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const n = connectNotice(window.location.search);
      if (n) {
        setNotice(n);
        window.history.replaceState(null, "", withoutConnectParams(window.location.href));
      }
      if (!RewardsSession.hasStored()) {
        setAuth("out");
        return;
      }
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const signOut = useCallback(() => {
    void session.signOut().then(() => {
      setMe(null);
      rememberPlus(null);
      setAuth("out");
    });
  }, [session]);

  if (gone)
    return (
      <Section id="profile" index={sectionIndex("profile")} kicker={t.kicker} title={t.data.deleted}>
        <p className="mt-6 text-muted">{t.data.deleted}</p>
      </Section>
    );

  if (auth === "checking")
    return (
      <Section id="profile" index={sectionIndex("profile")} kicker={t.signIn.kicker} title={t.signIn.title}>
        <p className="mt-10 text-muted">{t.loading}</p>
      </Section>
    );

  if (auth === "out")
    return (
      <>
        <SignIn
          dict={{ ...dict, signIn: { ...dict.signIn, index: sectionIndex("profile"), ...t.signIn } }}
          session={session}
          onSignedIn={() => {
            setAuth("checking");
            void load();
          }}
        />
        <OnThisPage t={t} />
      </>
    );

  if (!me)
    return (
      <Section id="profile" index={sectionIndex("profile")} kicker={t.kicker} title={t.signIn.title}>
        <p className="mt-6 text-muted" role="status">
          {loadError ?? t.loading}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={buttonClass("ghost")} onClick={() => void load()}>
            {t.retry}
          </button>
          <button type="button" className={buttonClass("ghost")} onClick={signOut}>
            {t.profile.signOut}
          </button>
        </div>
      </Section>
    );

  const p: PanelProps = {
    api,
    session,
    t,
    lang,
    me,
    setMe,
    dates: visitorDatePrefs(lang, me.prefs ?? null),
    errorMsg,
  };

  return (
    <>
      {notice && (
        <div className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p
            role="status"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              notice.endsWith("Ok") ? "border-up-fg/40 text-up-fg" : "border-down-fg/40 text-down-fg",
            )}
          >
            {t.notices[notice]}
          </p>
        </div>
      )}
      <ProfileSection {...p} onSignOut={signOut} />
      <AppSection {...p} />
      <RemindersSection {...p} />
      <PlanSection {...p} />
      <CoachSection {...p} />
      <HealthSection {...p} />
      <ZonesSection {...p} />
      <GoalsSection {...p} />
      <ConnectionsSection {...p} />
      <PulseSection {...p} />
      <PlusSection {...p} />
      <DataSection
        {...p}
        onDeleted={() => {
          void session.signOut();
          rememberPlus(null);
          setGone(true);
        }}
      />
    </>
  );
}

/** Before sign-in: what the page holds, so it reads the same as once signed in. */
function OnThisPage({ t }: { t: AccountDict }) {
  return (
    <Section id="settings" kicker={t.jump} title={t.heading} lead={t.lead}>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_SECTIONS.map((k) => (
          <li key={k} className="rounded-2xl border border-line bg-surface/60 p-5">
            <p className="font-mono text-xs text-pulse-fg">{sectionIndex(k)}</p>
            <p className="mt-1 font-display font-semibold">{t.sections[k]}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
