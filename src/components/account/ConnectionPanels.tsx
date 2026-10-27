"use client";

import { useEffect, useState } from "react";
import { accountTier, coachPlusActive, ownPlanName } from "@/lib/coachPlus";
import { Section } from "@/components/ui/Section";
import { format } from "@/i18n/dictionaries";
import {
  confirmed,
  MAX_WATCHLIST,
  SPOTIFY_ROUTE_SYNC,
  SPOTIFY_ROUTES,
  spotifyRouteOf,
  withoutPick,
  withPick,
  type Desk,
  type Me,
  type DeskRule,
  type Integrations,
  type Pulse,
  type SpotifyRoute,
  type SpotifyStatus,
} from "@/lib/accountApi";
import { formatDate } from "@/lib/datetime";
import { ApiError } from "@/lib/rewardsApi";
import { Card, linkButton, Pill, Row, Select, smallButton, smallInput, Toggle, useAction, Value } from "./AccountUi";
import { mins, pageUrl, sectionIndex, type PanelProps } from "./shared";

/**
 * The plan pill (Free, Coach Plus or Coach Premium: the API's tier "premium", or "pro" before the rename) and, for an
 * early tester, the "Early tester · Coach Premium" badge. On the profile line and the plan card.
 */
export function PlanPills({ t, me }: { t: PanelProps["t"]; me: Me }) {
  const tier = accountTier(me);
  const s = t.plusSection;
  return (
    <>
      <Pill tone={tier === "free" ? "muted" : "volt"}>{tier === "premium" ? s.tierPremium : tier === "plus" ? s.tierPlus : s.free}</Pill>
      {me.earlyTester === true && <Pill tone="ok">{s.earlyTester}</Pill>}
    </>
  );
}

export function ConnectionsSection(p: PanelProps) {
  const { t, api, session, me, errorMsg } = p;
  const c = t.connections;
  const [google, setGoogle] = useState<Integrations["google"] | undefined>(undefined);
  const [spotify, setSpotify] = useState<SpotifyStatus | null | undefined>(undefined);
  const [desk, setDesk] = useState<Desk | null | undefined>(undefined);
  const g = useAction((e) => (e instanceof ApiError && e.status === 404 ? c.googleOff : errorMsg(e)));
  const s = useAction((e) =>
    e instanceof ApiError && e.status === 403 ? c.spotifyPlus : e instanceof ApiError && e.status === 503 ? c.spotifyOff : errorMsg(e),
  );
  const d = useAction(errorMsg);
  const [route, setRoute] = useState<SpotifyRoute | null>(null);

  useEffect(() => {
    let live = true;
    api
      .integrations()
      .then((i) => live && setGoogle(i.google ?? null))
      .catch(() => live && setGoogle(null));
    api
      .spotify()
      .then((x) => {
        if (!live) return;
        setSpotify(x);
        setRoute(spotifyRouteOf(x));
      })
      .catch(() => live && setSpotify(null));
    api
      .desk()
      .then((x) => live && setDesk(x))
      .catch(() => live && setDesk(null));
    return () => {
      live = false;
    };
  }, [api]);

  const connectGoogle = () => void g.run(async () => window.location.assign(await api.googleStart(pageUrl())));
  const disconnectGoogle = () => {
    if (!window.confirm(format(c.disconnectConfirm, { name: c.google }))) return;
    void g.run(async () => {
      await api.googleDisconnect();
      setGoogle({ connected: false });
    });
  };
  const connectSpotify = () => void s.run(async () => window.location.assign(await api.spotifyStart(pageUrl())));
  const unlinkSpotify = () => {
    if (!window.confirm(format(c.disconnectConfirm, { name: c.spotify }))) return;
    void s.run(async () => {
      await api.spotifyUnlink();
      setSpotify((x) => (x ? { ...x, linked: false, reason: x.reason ?? "not_linked" } : x));
    });
  };
  const putRule = (r: Partial<DeskRule>) =>
    void d.run(async () => {
      const { rule } = await api.putDeskRule(r);
      setDesk((x) => (x ? { ...x, rule } : x));
    }, t.saved);

  const spotifyAvailable = spotify?.direct === true;
  const plus = coachPlusActive(me);
  const syncRoute = SPOTIFY_ROUTE_SYNC;

  return (
    <Section
      id="connections"
      index={sectionIndex("connections")}
      kicker={t.sections.connections}
      title={t.sections.connections}
      lead={c.lead}
    >
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card
          title={c.google}
          lead={c.googleLead}
          badge={
            google !== undefined && (
              <Pill tone={google?.connected ? "ok" : "muted"}>{google?.connected ? c.connected : c.notConnected}</Pill>
            )
          }
        >
          {google === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : google?.connected ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {google.email && <span className="text-sm text-muted">{format(c.googleAs, { email: google.email })}</span>}
              <button type="button" className={smallButton()} disabled={g.busy} onClick={disconnectGoogle}>
                {c.disconnect}
              </button>
            </div>
          ) : (
            <button type="button" className={smallButton("primary", "mt-4")} disabled={g.busy || me.guest === true} onClick={connectGoogle}>
              {c.connect}
            </button>
          )}
          {g.status}
        </Card>

        <Card title={c.apple} lead={c.appleNote} badge={<Pill>{t.appOnly}</Pill>} />

        <Card
          title={c.spotify}
          lead={c.spotifyLead}
          badge={
            spotify ? (
              <Pill tone={spotify.linked ? "ok" : plus ? "muted" : "volt"}>
                {spotify.linked ? c.connected : plus ? c.notConnected : t.plusSection.tierPlus}
              </Pill>
            ) : undefined
          }
        >
          {spotify === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : spotify === null || !spotifyAvailable ? (
            <p className="mt-4 text-sm text-muted">{c.spotifyOff}</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted">{spotify.linked ? c.spotifyLinked : c.spotifyNotLinked}</p>
              {!plus && !spotify.linked && <p className="mt-2 text-sm text-faint">{c.spotifyPlus}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {spotify.linked ? (
                  <button type="button" className={smallButton()} disabled={s.busy} onClick={unlinkSpotify}>
                    {c.disconnect}
                  </button>
                ) : spotify.web && plus ? (
                  <button type="button" className={smallButton("primary")} disabled={s.busy} onClick={connectSpotify}>
                    {c.connect}
                  </button>
                ) : plus ? (
                  <p className="text-sm text-faint">{c.spotifyFromApp}</p>
                ) : null}
              </div>
              {/* The route: a picker once the account keeps it (SPOTIFY_ROUTE_SYNC in src/lib/accountApi.ts), else where to set it. */}
              <Row label={c.route} hint={syncRoute ? undefined : c.routeApp}>
                {syncRoute ? (
                  <Select
                    value={route ?? "phone"}
                    options={SPOTIFY_ROUTES.map((r) => ({ value: r, label: c.routes[r] }))}
                    disabled={s.busy}
                    onChange={(r) =>
                      void s.run(async () => {
                        await syncRoute(session, r);
                        setRoute(r);
                      }, t.saved)
                    }
                  />
                ) : route ? (
                  <Value>{c.routes[route]}</Value>
                ) : (
                  <Pill>{t.appOnly}</Pill>
                )}
              </Row>
            </>
          )}
          {s.status}
        </Card>

        <Card title={c.music} lead={c.musicNote} badge={<Pill>{t.appOnly}</Pill>} />

        <Card title={c.desk} lead={c.deskLead} className="lg:col-span-2">
          {desk === undefined ? (
            <p className="mt-4 text-sm text-faint">{t.loading}</p>
          ) : desk === null ? (
            <p className="mt-4 text-sm text-faint">{t.error}</p>
          ) : (
            <div className="grid gap-x-8 lg:grid-cols-2">
              <div>
                <Row label={c.deskEnabled}>
                  <Toggle
                    label={c.deskEnabled}
                    checked={desk.rule.enabled}
                    disabled={d.busy}
                    onChange={(enabled) => putRule({ enabled })}
                  />
                </Row>
                <Row label={c.deskAfter} htmlFor="acct-desk-after">
                  <Select
                    id="acct-desk-after"
                    value={String(desk.rule.afterMin)}
                    options={stepOptions(30, 240, 15, desk.rule.afterMin).map((n) => ({ value: String(n), label: mins(t, n) }))}
                    disabled={d.busy}
                    onChange={(v) => putRule({ afterMin: Number(v) })}
                  />
                </Row>
                <Row label={c.deskUnlock} htmlFor="acct-desk-unlock">
                  <Select
                    id="acct-desk-unlock"
                    value={String(desk.rule.unlockMin)}
                    options={stepOptions(5, 30, 5, desk.rule.unlockMin).map((n) => ({ value: String(n), label: mins(t, n) }))}
                    disabled={d.busy}
                    onChange={(v) => putRule({ unlockMin: Number(v) })}
                  />
                </Row>
                <Row label={c.deskSkips} htmlFor="acct-desk-skips">
                  <Select
                    id="acct-desk-skips"
                    value={String(desk.rule.overridesPerDay)}
                    options={stepOptions(0, 5, 1, desk.rule.overridesPerDay).map((n) => ({ value: String(n), label: String(n) }))}
                    disabled={d.busy}
                    onChange={(v) => putRule({ overridesPerDay: Number(v) })}
                  />
                </Row>
                <Row label={c.deskUnlockBy} htmlFor="acct-desk-by">
                  <Select
                    id="acct-desk-by"
                    value={desk.rule.unlockBy === "away" ? "away" : "move"}
                    options={[
                      { value: "move", label: c.deskBy.move },
                      { value: "away", label: c.deskBy.away },
                    ]}
                    disabled={d.busy}
                    onChange={(unlockBy) => putRule({ unlockBy })}
                  />
                </Row>
                <Row label={c.deskWarn} htmlFor="acct-desk-warn">
                  <Select
                    id="acct-desk-warn"
                    value={String(desk.rule.warnMin)}
                    options={stepOptions(0, 30, 5, desk.rule.warnMin).map((n) => ({ value: String(n), label: mins(t, n) }))}
                    disabled={d.busy}
                    onChange={(v) => putRule({ warnMin: Number(v) })}
                  />
                </Row>
              </div>
              <div>
                {!desk.desks?.length ? (
                  <p className="mt-4 text-sm text-faint">{c.deskNone}</p>
                ) : (
                  <ul className="mt-2">
                    {desk.desks.map((x) => (
                      <li
                        key={x.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-text">{x.name || t.profile.kinds.desk}</p>
                          {x.lockedSince && typeof x.toUnlock === "number" && (
                            <p className="text-xs text-butter-fg">{format(c.deskLocked, { n: x.toUnlock })}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          className={linkButton}
                          disabled={d.busy}
                          onClick={() =>
                            void d.run(async () => {
                              await api.unlinkDesk(x.id);
                              setDesk((cur) => (cur ? { ...cur, desks: (cur.desks ?? []).filter((y) => y.id !== x.id) } : cur));
                            })
                          }
                        >
                          {c.disconnect}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-xs text-faint">{c.phoneFocus}</p>
              </div>
            </div>
          )}
          {d.status}
        </Card>

        <Card title={c.health} lead={c.healthNote} badge={<Pill>{t.appOnly}</Pill>} />
        <Card title={c.other} lead={c.otherNote} />
      </div>
    </Section>
  );
}

/** Steps from `min` to `max`, with the current value kept even when it's off the grid. */
function stepOptions(min: number, max: number, step: number, current: number): number[] {
  const out: number[] = [];
  for (let n = min; n <= max; n += step) out.push(n);
  if (!out.includes(current)) out.push(current);
  return out.sort((a, b) => a - b);
}

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export function PulseSection(p: PanelProps) {
  const { t, api, errorMsg } = p;
  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<"stock" | "crypto">("stock");
  const a = useAction(errorMsg);

  useEffect(() => {
    let live = true;
    api
      .pulse()
      .then((x) => live && setPulse(x))
      .catch(() => live && setPulse(null));
    return () => {
      live = false;
    };
  }, [api]);

  const put = (
    cur: Pulse,
    patch: Partial<{
      watchlist: Pulse["watchlist"];
      brandTeam: string | null;
      quietHours: { start: string; end: string };
      pushesPerDay: number;
    }>,
  ) =>
    void a.run(async () => {
      const next = await api.putPulse({
        watchlist: patch.watchlist ?? cur.watchlist,
        brandTeam: patch.brandTeam !== undefined ? patch.brandTeam : (cur.brandTeam ?? null),
        ...((patch.quietHours ?? cur.quietHours) ? { quietHours: patch.quietHours ?? cur.quietHours! } : {}),
        ...(typeof (patch.pushesPerDay ?? cur.pushesPerDay) === "number"
          ? { pushesPerDay: (patch.pushesPerDay ?? cur.pushesPerDay)! }
          : {}),
      });
      setPulse(next);
    }, t.saved);

  return (
    <Section id="pulse" index={sectionIndex("pulse")} kicker={t.sections.pulse} title={t.sections.pulse} lead={t.pulse.lead}>
      {pulse === undefined ? (
        <p className="mt-8 text-sm text-faint">{t.loading}</p>
      ) : pulse === null ? (
        <p className="mt-8 text-sm text-faint">{t.error}</p>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card title={t.pulse.picks} lead={format(t.pulse.max, { n: MAX_WATCHLIST })}>
            {!pulse.watchlist.length ? (
              <p className="mt-4 text-sm text-faint">{t.pulse.none}</p>
            ) : (
              <ul className="mt-2">
                {pulse.watchlist.map((w) => (
                  <li
                    key={`${w.kind}:${w.symbol}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 first:border-t-0"
                  >
                    <p className="text-sm text-text">
                      <span className="font-mono">{w.symbol}</span>{" "}
                      <span className="text-xs text-faint">{(t.pulse.kinds as Record<string, string>)[w.kind] ?? w.kind}</span>{" "}
                      {pulse.brandTeam === w.symbol && w.kind === "stock" && <Pill tone="volt">{t.pulse.brandTeam}</Pill>}
                      {typeof w.thresholdPct === "number" && (
                        <span className="ml-1 text-xs text-muted">{`${t.pulse.threshold} ${w.thresholdPct} %`}</span>
                      )}
                    </p>
                    <button
                      type="button"
                      className={linkButton}
                      disabled={a.busy}
                      onClick={() => put(pulse, withoutPick(pulse, w.symbol, w.kind))}
                    >
                      {t.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-4 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const next = withPick(pulse, symbol, kind);
                if (!next) return;
                put(pulse, { watchlist: next });
                setSymbol("");
              }}
            >
              <input
                aria-label={t.pulse.symbol}
                placeholder={t.pulse.symbol}
                className={`${smallInput} w-32 font-mono uppercase`}
                maxLength={10}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
              <Select
                value={kind}
                options={[
                  { value: "stock", label: t.pulse.kinds.stock },
                  { value: "crypto", label: t.pulse.kinds.crypto },
                ]}
                onChange={setKind}
                className="min-w-28"
              />
              <button type="submit" className={smallButton()} disabled={a.busy || !withPick(pulse, symbol, kind)}>
                {t.pulse.add}
              </button>
            </form>
          </Card>
          <Card title={t.pulse.pushes}>
            <Row label={t.pulse.pushes} htmlFor="acct-pulse-pushes">
              <Select
                id="acct-pulse-pushes"
                value={String(pulse.pushesPerDay ?? 1)}
                options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
                disabled={a.busy}
                onChange={(v) => put(pulse, { pushesPerDay: Number(v) })}
              />
            </Row>
            <Row label={t.pulse.quiet}>
              <span className="text-sm text-muted">{t.pulse.quietFrom}</span>
              <Select
                value={pulse.quietHours?.start ?? "22:00"}
                options={hours.map((h) => ({ value: h, label: h }))}
                disabled={a.busy}
                onChange={(start) => put(pulse, { quietHours: { start, end: pulse.quietHours?.end ?? "07:00" } })}
                className="min-w-24"
              />
              <span className="text-sm text-muted">{t.pulse.quietTo}</span>
              <Select
                value={pulse.quietHours?.end ?? "07:00"}
                options={hours.map((h) => ({ value: h, label: h }))}
                disabled={a.busy}
                onChange={(end) => put(pulse, { quietHours: { start: pulse.quietHours?.start ?? "22:00", end } })}
                className="min-w-24"
              />
            </Row>
          </Card>
        </div>
      )}
      {a.status}
    </Section>
  );
}

export function PlusSection(p: PanelProps) {
  const { t, me, api, session, setMe, lang, dates, errorMsg } = p;
  const a = useAction(errorMsg);
  const plus = coachPlusActive(me);
  const premium = accountTier(me) === "premium";
  // The section names the plan the account has (Premium for Premium and testers, else Plus).
  const plan = ownPlanName(me);
  const src = me.plusSource ?? "";
  const srcLabel = (t.plusSection.sources as Record<string, string>)[src];

  return (
    <Section id="plus" index={sectionIndex("plus")} kicker={plan} title={plan} lead={format(t.plusSection.lead, { plan })}>
      <div className="mt-8 max-w-3xl">
        <Card
          title={plan}
          badge={
            <span className="flex flex-wrap justify-end gap-1.5">
              <PlanPills t={t} me={me} />
            </span>
          }
        >
          <p className="mt-4 font-display text-2xl font-semibold">
            {plus && me.plusUntil
              ? format(premium ? t.plusSection.activePremium : t.plusSection.active, { date: formatDate(me.plusUntil, dates, "medium") })
              : plus
                ? plan
                : t.plusSection.free}
          </p>
          {srcLabel && <p className="mt-1 text-sm text-muted">{srcLabel}</p>}
          {(src === "apple" || src === "google") && <p className="mt-2 text-sm text-faint">{t.plusSection.store}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/${lang}/plans/`} className={smallButton("primary")}>
              {format(t.plusSection.manage, { plan })}
            </a>
            {src === "stripe" && (
              <button
                type="button"
                className={smallButton()}
                disabled={a.busy}
                onClick={() => void a.run(async () => window.location.assign((await session.stripePortal(lang)).url))}
              >
                {t.plusSection.portal}
              </button>
            )}
            {src === "preview" && plus && (
              <button
                type="button"
                className={smallButton()}
                disabled={a.busy}
                onClick={() => void a.run(async () => (await api.preview(false), setMe(await api.me())), t.saved)}
              >
                {t.plusSection.previewOff}
              </button>
            )}
            {src === "preview_off" && !plus && (
              <button
                type="button"
                className={smallButton()}
                disabled={a.busy}
                onClick={() => void a.run(async () => (await api.preview(true), setMe(await api.me())), t.saved)}
              >
                {t.plusSection.previewOn}
              </button>
            )}
          </div>
          {a.status}
        </Card>
      </div>
    </Section>
  );
}

export function DataSection(p: PanelProps & { onDeleted: () => void }) {
  const { t, api, me, setMe, errorMsg } = p;
  const plan = ownPlanName(me);
  const [freshTyped, setFreshTyped] = useState("");
  const [deleteTyped, setDeleteTyped] = useState("");
  const fresh = useAction((e) => (e instanceof ApiError && e.status === 429 ? t.data.freshLimit : errorMsg(e)));
  const del = useAction(errorMsg);

  return (
    <Section id="data" index={sectionIndex("data")} kicker={t.sections.data} title={t.sections.data} lead={t.data.lead}>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title={t.data.fresh} lead={t.data.freshIntro} className="lg:col-span-2">
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-text">{t.data.resets}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {t.data.resetItems.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{t.data.stays}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {t.data.stayItems.map((x) => (
                  <li key={x}>{format(x, { plan })}</li>
                ))}
              </ul>
            </div>
          </div>
          <label htmlFor="acct-fresh" className="mt-5 block text-sm text-muted">
            {format(t.data.freshType, { word: t.data.freshWord })}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="acct-fresh"
              className={`${smallInput} w-40 font-mono uppercase`}
              autoComplete="off"
              value={freshTyped}
              onChange={(e) => setFreshTyped(e.target.value)}
            />
            <button
              type="button"
              className={smallButton("primary")}
              disabled={fresh.busy || !confirmed(freshTyped, t.data.freshWord)}
              onClick={() =>
                void fresh.run(async () => {
                  await api.freshStart();
                  setMe(await api.me());
                  setFreshTyped("");
                }, t.data.freshDone)
              }
            >
              {t.data.freshButton}
            </button>
          </div>
          {fresh.status}
        </Card>

        <Card title={t.data.export} lead={t.data.exportNote} badge={<Pill>{t.appOnly}</Pill>} />

        <Card title={t.data.delete} lead={format(t.data.deleteNote, { plan })} className="border-down-fg/40">
          <label htmlFor="acct-delete" className="mt-4 block text-sm text-muted">
            {format(t.data.deleteType, { word: t.data.deleteWord })}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="acct-delete"
              className={`${smallInput} w-40 font-mono uppercase`}
              autoComplete="off"
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
            />
            <button
              type="button"
              className={smallButton("ghost", "border-down-fg/60 text-down-fg")}
              disabled={del.busy || !confirmed(deleteTyped, t.data.deleteWord)}
              onClick={() =>
                void del.run(async () => {
                  await api.deleteAccount();
                  p.onDeleted();
                })
              }
            >
              {t.data.deleteButton}
            </button>
          </div>
          {del.status}
        </Card>
      </div>
    </Section>
  );
}
