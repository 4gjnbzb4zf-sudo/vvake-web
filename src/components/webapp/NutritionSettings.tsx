"use client";

import { useState } from "react";
import { fmt } from "@/i18n/webapp";
import type { Locale } from "@/i18n/config";
import { getNutritionDict, type NutritionDict } from "@/i18n/nutrition";
import { cn } from "@/lib/cn";
import {
  ALLERGENS,
  BUDGETS,
  COOK_TIMES,
  DIET_STYLES,
  INTOLERANCES,
  NUTRITION_GOALS,
  type NutritionProfile,
} from "@/lib/webapp/nutrition/core";
import { addTerm } from "@/lib/webapp/nutrition/view";
import { useApp } from "./AppContext";
import type { NutritionState } from "./useNutrition";
import { Btn, Card, H2, inputCls, Small, Toggle } from "./ui";

/**
 * Settings › Nutrition on the web (VVFit ADR-0070): the goal (getting leaner only for an adult outside calm mode),
 * how you eat, allergies / intolerances (the common ones as chips, EN/FR, plus your own words) and dislikes (all hard
 * constraints), cooking time, budget, meals a day, servings, the age question, Hide numbers, calm mode, the coach's
 * photo asks, the coarse region (country + region code, never a position). Keep photos and Health write belong to the
 * phone: shown, explained, not switchable here. Each change saves at once (newest wins across devices).
 */
export function NutritionSettings({ n }: { n: NutritionState }) {
  const { profile, save, tn } = n;
  const { lang } = useApp();
  if (!profile) return null;
  return (
    <div className="space-y-4">
      <NutritionProfileForm profile={profile} save={save} tn={tn} lang={lang} />
      <Card>
        <Btn variant="ghost" className="w-full" onClick={() => void n.setOn(false)}>
          {tn.settings.turnOff}
        </Btn>
        <Small className="mt-2">{tn.settings.offNote}</Small>
      </Card>
    </div>
  );
}

/** The form itself, shared with vvake.com/account (Nutrition). */
export function NutritionProfileForm({
  profile,
  save,
  tn,
  lang,
}: {
  lang: Locale;
  profile: NutritionProfile;
  save: (c: Partial<NutritionProfile>) => Promise<boolean>;
  tn: NutritionDict;
}) {
  const s = tn.settings;
  const [msg, setMsg] = useState<string | null>(null);
  const put = (c: Partial<NutritionProfile>) => {
    setMsg(null);
    void save(c).then((ok) => setMsg(ok ? s.saved : tn.error));
  };
  const leanOk = profile.adult === true && !profile.flagged;
  return (
    <div className="space-y-4">
      <Card>
        <H2>{s.goal}</H2>
        <Chips
          options={NUTRITION_GOALS.filter((g) => g !== "lean" || leanOk || profile.goal === "lean").map((g) => ({
            k: g,
            label: s.goals[g],
          }))}
          on={(k) => profile.goal === k}
          onTap={(k) => put({ goal: k as NutritionProfile["goal"] })}
          single
          label={s.goal}
        />
        {!leanOk && <Small className="mt-2">{s.leanAdult}</Small>}
      </Card>

      <Card>
        <H2>{s.diet}</H2>
        <Chips
          options={DIET_STYLES.map((d) => ({ k: d, label: s.diets[d] }))}
          on={(k) => profile.diet === k}
          onTap={(k) => put({ diet: k as NutritionProfile["diet"] })}
          single
          label={s.diet}
        />
      </Card>

      <TermsCard
        title={s.allergies}
        hint={s.allergiesHint}
        tn={tn}
        common={ALLERGENS.map((k) => ({ k, label: s.allergens[k] }))}
        list={profile.allergies}
        onChange={(allergies) => put({ allergies })}
      />
      <TermsCard
        title={s.intolerances}
        tn={tn}
        common={INTOLERANCES.map((k) => ({ k, label: s.intoleranceNames[k] }))}
        list={profile.intolerances}
        onChange={(intolerances) => put({ intolerances })}
      />
      <TermsCard title={s.dislikes} hint={s.dislikesHint} tn={tn} list={profile.dislikes} onChange={(dislikes) => put({ dislikes })} />

      <Card>
        <H2>{s.cook}</H2>
        <Chips
          options={COOK_TIMES.map((m) => ({ k: String(m), label: fmt(s.cookMin, { n: m }) }))}
          on={(k) => String(profile.cookMinutes) === k}
          onTap={(k) => put({ cookMinutes: Number(k) as NutritionProfile["cookMinutes"] })}
          single
          label={s.cook}
        />
        <H2 className="mt-4">{s.budget}</H2>
        <Chips
          options={BUDGETS.map((b) => ({ k: b, label: s.budgets[b] }))}
          on={(k) => profile.budget === k}
          onTap={(k) => put({ budget: k as NutritionProfile["budget"] })}
          single
          label={s.budget}
        />
        <H2 className="mt-4">{s.mealsPerDay}</H2>
        <Chips
          options={[2, 3, 4, 5].map((m) => ({ k: String(m), label: String(m) }))}
          on={(k) => String(profile.mealsPerDay) === k}
          onTap={(k) => put({ mealsPerDay: Number(k) as NutritionProfile["mealsPerDay"] })}
          single
          label={s.mealsPerDay}
        />
        <H2 className="mt-4">{s.servings}</H2>
        <Chips
          options={[1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({ k: String(m), label: String(m) }))}
          on={(k) => String(profile.servings ?? 1) === k}
          onTap={(k) => put({ servings: Number(k) })}
          single
          label={s.servings}
        />
      </Card>

      <Card>
        <H2>{s.adult}</H2>
        <Chips
          options={[
            { k: "yes", label: s.adultYes },
            { k: "no", label: s.adultNo },
          ]}
          on={(k) => (k === "yes" ? profile.adult === true : profile.adult === false)}
          onTap={(k) => put({ adult: k === "yes" })}
          single
          label={s.adult}
        />
        <Small className="mt-2">{s.adultNote}</Small>
      </Card>

      <Card className="space-y-4">
        <SwitchRow
          label={s.hideNumbers}
          hint={s.hideNumbersHint}
          on={profile.hideNumbers || profile.flagged}
          disabled={profile.flagged}
          onChange={(v) => put({ hideNumbers: v })}
        />
        <SwitchRow
          label={s.calm}
          hint={s.calmHint}
          on={profile.flagged}
          onChange={(v) => put({ flagged: v, ...(v ? { hideNumbers: true } : {}) })}
        />
        <SwitchRow label={s.askPhotos} hint={s.askPhotosHint} on={profile.askPhotos} onChange={(v) => put({ askPhotos: v })} />
        {profile.askPhotos && (
          <SwitchRow label={s.askInQuiet} on={profile.askPhotosInQuiet} onChange={(v) => put({ askPhotosInQuiet: v })} />
        )}
        <div>
          <p className="text-[15px] font-medium">{s.keepPhotos}</p>
          <Small>{s.keepPhotosWeb}</Small>
        </div>
        <div>
          <p className="text-[15px] font-medium">{s.healthWrite}</p>
          <Small>{profile.healthWrite ? `✓ ${s.healthWriteWeb}` : s.healthWriteWeb}</Small>
        </div>
      </Card>

      <RegionCard tn={tn} region={profile.region ?? null} onChange={(region) => put({ region: region ?? undefined })} />

      {msg && (
        <p role="status" className="text-sm text-mint-fg">
          {msg}
        </p>
      )}
      <Small>
        {s.disclaimer}{" "}
        <a className="underline" href={`/${lang}/privacy/#nutrition`}>
          {s.privacy}
        </a>
      </Small>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  on,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{label}</p>
        {hint && <Small>{hint}</Small>}
      </div>
      <Toggle on={on} label={label} onChange={(v) => !disabled && onChange(v)} />
    </div>
  );
}

function Chips({
  options,
  on,
  onTap,
  single,
  label,
}: {
  options: { k: string; label: string }[];
  on: (k: string) => boolean;
  onTap: (k: string) => void;
  single?: boolean;
  label: string;
}) {
  return (
    <div role={single ? "radiogroup" : "group"} aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          role={single ? "radio" : undefined}
          aria-checked={single ? on(o.k) : undefined}
          aria-pressed={single ? undefined : on(o.k)}
          onClick={() => onTap(o.k)}
          className={cn(
            "min-h-10 rounded-full border px-3 text-sm",
            on(o.k) ? "border-volt bg-volt font-semibold text-ink" : "border-line bg-surface-2 text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A constraint list: the common ones as chips (tap to add / remove), your own words added and removable. */
function TermsCard({
  title,
  hint,
  tn,
  common,
  list,
  onChange,
}: {
  title: string;
  hint?: string;
  tn: NutritionDict;
  common?: { k: string; label: string }[];
  list: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const s = tn.settings;
  const [text, setText] = useState("");
  const commonKeys = new Set((common ?? []).map((c) => c.k));
  const own = list.filter((x) => !commonKeys.has(x));
  return (
    <Card>
      <H2>{title}</H2>
      {hint && <Small className="mt-1">{hint}</Small>}
      {common && (
        <Chips
          options={common}
          on={(k) => list.includes(k)}
          onTap={(k) => onChange(list.includes(k) ? list.filter((x) => x !== k) : addTerm(list, k))}
          label={title}
        />
      )}
      {own.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {own.map((x) => (
            <li key={x}>
              <button
                type="button"
                aria-label={fmt(s.remove, { x })}
                onClick={() => onChange(list.filter((y) => y !== x))}
                className="min-h-10 rounded-full border border-volt bg-volt px-3 text-sm font-semibold text-ink"
              >
                {x} ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onChange(addTerm(list, text));
          setText("");
        }}
      >
        <input
          className={cn(inputCls, "flex-1")}
          value={text}
          maxLength={40}
          placeholder={s.addPlaceholder}
          aria-label={`${title}: ${s.addOwn}`}
          onChange={(e) => setText(e.target.value)}
        />
        <Btn type="submit" variant="ghost" disabled={!text.trim()}>
          {s.add}
        </Btn>
      </form>
    </Card>
  );
}

/** Country + region codes only (ISO 3166: FR, CA + QC…), typed or cleared; never a position. */
function RegionCard({
  tn,
  region,
  onChange,
}: {
  tn: NutritionDict;
  region: { country: string; region?: string } | null;
  onChange: (r: { country: string; region?: string } | null) => void;
}) {
  const s = tn.settings;
  const [country, setCountry] = useState(region?.country ?? "");
  const [reg, setReg] = useState(region?.region ?? "");
  const c = country.trim().toUpperCase();
  const r = reg.trim().toUpperCase();
  const valid = /^[A-Z]{2}$/.test(c) && (!r || /^[A-Z0-9]{1,3}$/.test(r));
  return (
    <Card>
      <H2>{s.region}</H2>
      <Small className="mt-1">{s.regionHint}</Small>
      <div className="mt-3 flex gap-2">
        <input
          className={cn(inputCls, "w-24")}
          value={country}
          maxLength={2}
          placeholder="FR"
          aria-label={s.country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <input
          className={cn(inputCls, "w-24")}
          value={reg}
          maxLength={3}
          placeholder="QC"
          aria-label={s.regionCode}
          onChange={(e) => setReg(e.target.value)}
        />
        <Btn variant="ghost" disabled={!valid} onClick={() => onChange({ country: c, ...(r ? { region: r } : {}) })}>
          {s.save}
        </Btn>
      </div>
      {region && (
        <button
          type="button"
          className="mt-2 text-sm text-muted underline"
          onClick={() => {
            setCountry("");
            setReg("");
            onChange(null);
          }}
        >
          {s.regionClear}
        </button>
      )}
    </Card>
  );
}

/** The dictionary for a page outside the web app (vvake.com/account). */
export const nutritionDictFor = (lang: Locale) => getNutritionDict(lang);
