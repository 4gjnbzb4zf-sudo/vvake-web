"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { format } from "@/i18n/dictionaries";
import { DEFAULT_MOVE_AT, fromHhmm, remindersOf, sortedMeals, toHhmm, type Device, type MePatch, type Reminders } from "@/lib/accountApi";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { ApiError } from "@/lib/rewardsApi";
import { PlanPills } from "./ConnectionPanels";
import { Card, linkButton, Pill, Row, Select, smallButton, smallInput, Toggle, useAction, Value } from "./AccountUi";
import { sectionIndex, type PanelProps } from "./shared";

/** This browser's device id (src/lib/rewardsApi.ts keeps it), to mark it in the list. */
function thisDeviceId(): string | null {
  try {
    return window.localStorage.getItem("vvake-web-device");
  } catch {
    return null;
  }
}

export function ProfileSection(p: PanelProps & { onSignOut: () => void }) {
  const { t, me, api, setMe, dates, errorMsg } = p;
  const [name, setName] = useState(me.name ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const profile = useAction((e) => (e instanceof ApiError && e.status === 409 ? t.profile.citySeason : errorMsg(e)));
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const dev = useAction(errorMsg);

  useEffect(() => {
    let live = true;
    api
      .devices()
      .then((d) => live && setDevices(d))
      .catch(() => live && setDevices([]));
    const id = window.setTimeout(() => setMine(thisDeviceId()), 0);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [api]);

  const save = () => {
    const patch: MePatch = {};
    if (name.trim() !== (me.name ?? "")) patch.name = name.trim();
    if (city.trim() !== (me.city ?? "")) patch.city = city.trim() || null;
    if (!Object.keys(patch).length) return;
    void profile.run(async () => setMe(await api.patchMe(patch)), t.saved);
  };

  const who = me.email || me.name || "VVake";
  const kind = (k: string) => (t.profile.kinds as Record<string, string>)[k] ?? t.profile.kinds.other;

  return (
    <Section id="profile" index={sectionIndex("profile")} kicker={t.sections.profile} title={t.sections.profile} lead={t.profile.lead}>
      <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>{format(t.profile.signedInAs, { name: who })}</span>
        <button type="button" className={linkButton} onClick={p.onSignOut}>
          {t.profile.signOut}
        </button>
        <PlanPills t={t} me={me} />
      </div>
      {me.guest && (
        <p className="mt-4 rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{t.profile.guest}</p>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title={t.sections.profile}>
          <Row label={t.profile.name} htmlFor="acct-name">
            <input
              id="acct-name"
              className={smallInput}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
          </Row>
          <Row label={t.profile.city} hint={t.profile.cityHint} htmlFor="acct-city">
            <input
              id="acct-city"
              className={smallInput}
              maxLength={80}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
            />
          </Row>
          <button type="button" className={smallButton("primary", "mt-2")} disabled={profile.busy} onClick={save}>
            {profile.busy ? t.saving : t.save}
          </button>
          {profile.status}
        </Card>
        <Card title={t.profile.devices} lead={t.profile.devicesLead}>
          {devices === null ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : (
            <ul className="mt-2">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 first:border-t-0">
                  <div className="min-w-0">
                    <p className="text-sm text-text">
                      {d.model || kind(d.kind)} {d.id === mine && <Pill tone="volt">{t.profile.thisBrowser}</Pill>}
                    </p>
                    <p className="text-xs text-faint">
                      {kind(d.kind)}
                      {d.lastSeenAt ? ` · ${format(t.profile.lastSeen, { date: formatDateTime(d.lastSeenAt, dates, "short") })}` : ""}
                    </p>
                  </div>
                  {d.id !== mine && (
                    <button
                      type="button"
                      className={linkButton}
                      disabled={dev.busy}
                      onClick={() =>
                        void dev.run(async () => {
                          await api.removeDevice(d.id);
                          setDevices((list) => (list ?? []).filter((x) => x.id !== d.id));
                        })
                      }
                    >
                      {t.remove}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {dev.status}
        </Card>
      </div>
      {me.freshStartAt && <p className="mt-4 text-xs text-faint">{`${t.data.fresh}: ${formatDate(me.freshStartAt, dates, "medium")}`}</p>}
    </Section>
  );
}

type Choice<T extends string> = { value: T; label: string };

export function AppSection(p: PanelProps) {
  const { t, me, api, setMe, errorMsg } = p;
  const a = useAction(errorMsg);
  const prefs = me.prefs ?? {};
  const pick = <T extends string>(v: string | null | undefined, allowed: readonly T[]): T =>
    allowed.includes(v as T) ? (v as T) : ("system" as T);

  const patch = (prefsPatch: NonNullable<MePatch["prefs"]>) =>
    void a.run(async () => setMe(await api.patchMe({ prefs: prefsPatch })), t.saved);

  const langs: Choice<"system" | "en" | "fr">[] = [
    { value: "system", label: t.app.system },
    { value: "en", label: t.app.lang.en },
    { value: "fr", label: t.app.lang.fr },
  ];
  const themes: Choice<"system" | "light" | "dark">[] = [
    { value: "system", label: t.app.system },
    { value: "light", label: t.app.themes.light },
    { value: "dark", label: t.app.themes.dark },
  ];
  const clocks: Choice<"system" | "12h" | "24h">[] = [
    { value: "system", label: t.app.system },
    { value: "24h", label: t.app.clock["24h"] },
    { value: "12h", label: t.app.clock["12h"] },
  ];
  const orders: Choice<"system" | "dmy" | "mdy" | "ymd">[] = [
    { value: "system", label: t.app.system },
    { value: "dmy", label: t.app.dates.dmy },
    { value: "mdy", label: t.app.dates.mdy },
    { value: "ymd", label: t.app.dates.ymd },
  ];
  const units = me.coach?.units === "imperial" || me.coach?.units === "metric" ? t.app.unitsValue[me.coach.units] : t.notSet;

  return (
    <Section id="app" index={sectionIndex("app")} kicker={t.sections.app} title={t.sections.app} lead={t.app.lead}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.sections.app}>
          <Row label={t.app.language} htmlFor="acct-lang">
            <Select
              id="acct-lang"
              value={pick(prefs.lang, ["system", "en", "fr"] as const)}
              options={langs}
              disabled={a.busy}
              onChange={(lang) => patch({ lang })}
            />
          </Row>
          <Row label={t.app.theme} htmlFor="acct-theme">
            <Select
              id="acct-theme"
              value={pick(prefs.theme, ["system", "light", "dark"] as const)}
              options={themes}
              disabled={a.busy}
              onChange={(theme) => patch({ theme })}
            />
          </Row>
          <Row label={t.app.timeFormat} htmlFor="acct-clock">
            <Select
              id="acct-clock"
              value={pick(prefs.timeFormat, ["system", "12h", "24h"] as const)}
              options={clocks}
              disabled={a.busy}
              onChange={(timeFormat) => patch({ timeFormat })}
            />
          </Row>
          <Row label={t.app.dateFormat} htmlFor="acct-dates">
            <Select
              id="acct-dates"
              value={pick(prefs.dateFormat, ["system", "dmy", "mdy", "ymd"] as const)}
              options={orders}
              disabled={a.busy}
              onChange={(dateFormat) => patch({ dateFormat })}
            />
          </Row>
          {a.status}
        </Card>
        <Card title={t.app.cityClash}>
          <Row label={t.app.cityClash} hint={t.app.cityClashHint}>
            <Toggle
              label={t.app.cityClash}
              checked={prefs.cityClashAlerts !== false}
              disabled={a.busy}
              onChange={(cityClashAlerts) => patch({ cityClashAlerts })}
            />
          </Row>
          <Row label={t.app.units} hint={t.app.unitsNote}>
            <Value>{units}</Value>
            <Pill>{t.appOnly}</Pill>
          </Row>
          <Row label={t.app.moments} hint={t.appOnlyNote}>
            <Pill>{t.appOnly}</Pill>
          </Row>
        </Card>
      </div>
    </Section>
  );
}

export function RemindersSection(p: PanelProps) {
  const { t, me, api, setMe, errorMsg } = p;
  const [r, setR] = useState<Reminders>(() => remindersOf(me));
  const a = useAction(errorMsg);
  const set = (patch: Partial<Reminders>) => setR((cur) => ({ ...cur, ...patch }));
  const never = !me.prefs?.reminders;
  const timeInput = (id: string, minutes: number, onChange: (m: number) => void) => (
    <input
      id={id}
      type="time"
      step={900}
      className={`${smallInput} w-32`}
      value={toHhmm(minutes)}
      onChange={(e) => {
        const m = fromHhmm(e.target.value);
        if (m !== null) onChange(m);
      }}
    />
  );
  const save = () =>
    void a.run(async () => {
      const reminders: Reminders = { ...r, meals: sortedMeals(r.meals) };
      setMe(await api.patchMe({ prefs: { reminders } }));
      setR(reminders);
    }, t.saved);

  return (
    <Section
      id="reminders"
      index={sectionIndex("reminders")}
      kicker={t.sections.reminders}
      title={t.sections.reminders}
      lead={t.reminders.lead}
    >
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.reminders.rhythmOn} lead={never ? t.reminders.defaults : t.reminders.quiet}>
          <Row label={t.reminders.rhythmOn}>
            <Toggle label={t.reminders.rhythmOn} checked={r.rhythmOn} onChange={(rhythmOn) => set({ rhythmOn })} />
          </Row>
          <Row label={t.reminders.wake} htmlFor="acct-wake">
            {timeInput("acct-wake", r.wakeMinutes, (wakeMinutes) => set({ wakeMinutes }))}
          </Row>
          <Row label={t.reminders.water}>
            <Toggle label={t.reminders.water} checked={r.waterOn} onChange={(waterOn) => set({ waterOn })} />
          </Row>
          <Row label={t.reminders.sleep}>
            <Toggle label={t.reminders.sleep} checked={r.sleepOn} onChange={(sleepOn) => set({ sleepOn })} />
          </Row>
          <Row label={t.reminders.meals}>
            <Toggle label={t.reminders.meals} checked={r.mealsOn} onChange={(mealsOn) => set({ mealsOn })} />
          </Row>
          {r.mealsOn &&
            r.meals.map((m, i) => (
              <Row key={i} label={format(t.reminders.meal, { n: i + 1 })} htmlFor={`acct-meal-${i}`}>
                {timeInput(`acct-meal-${i}`, m, (v) => set({ meals: r.meals.map((x, j) => (j === i ? v : x)) }))}
                {r.meals.length > 1 && (
                  <button type="button" className={linkButton} onClick={() => set({ meals: r.meals.filter((_, j) => j !== i) })}>
                    {t.remove}
                  </button>
                )}
              </Row>
            ))}
          {r.mealsOn && r.meals.length < 6 && (
            <button
              type="button"
              className={smallButton("ghost", "mt-2")}
              onClick={() => set({ meals: [...r.meals, Math.min(1380, (r.meals.at(-1) ?? 720) + 180)] })}
            >
              {t.reminders.addMeal}
            </button>
          )}
        </Card>
        <Card title={t.reminders.dailyMove}>
          <Row label={t.reminders.dailyMove}>
            <Toggle
              label={t.reminders.dailyMove}
              checked={!!r.dailyMove?.remind}
              onChange={(remind) => set({ dailyMove: { remind, at: r.dailyMove?.at ?? DEFAULT_MOVE_AT } })}
            />
          </Row>
          {r.dailyMove?.remind && (
            <Row label={t.reminders.dailyMoveAt} htmlFor="acct-move">
              {timeInput("acct-move", r.dailyMove.at, (at) => set({ dailyMove: { remind: true, at } }))}
            </Row>
          )}
          <Row label={t.reminders.pulseAlerts}>
            <Toggle label={t.reminders.pulseAlerts} checked={!!r.pulseAlerts} onChange={(pulseAlerts) => set({ pulseAlerts })} />
          </Row>
        </Card>
      </div>
      <button type="button" className={smallButton("primary", "mt-6")} disabled={a.busy} onClick={save}>
        {a.busy ? t.saving : t.save}
      </button>
      {a.status}
    </Section>
  );
}
