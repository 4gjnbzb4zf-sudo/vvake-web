"use client";

import { useState, type ReactNode } from "react";
import { Section } from "@/components/ui/Section";
import { getTailorDict } from "@/i18n/tailor";
import { format } from "@/i18n/dictionaries";
import {
  tailorFromAnswers,
  tailorText,
  TAILOR_FEATURE_NAMES,
  TAILOR_FEATURES,
  TAILOR_PRESET_TEXT,
  type TailorFeature,
  type TailorPrefs,
  type TailorProfile,
} from "@/lib/webapp/tailor/tailor";
import { nextTailorPrefs } from "@/lib/webapp/tailor/prefs";
import { Card, Row, Toggle, useAction } from "./AccountUi";
import type { PanelProps } from "./shared";

/**
 * vvake.com/account with "Your VVake" on (ADR-0059): the profile's features with their switches (the summary's
 * toggles, the same on every device) and a link to the survey in the web app. Shown only while the switch is on.
 */
export function TailorSection(p: PanelProps & { tailor: TailorPrefs; profile: TailorProfile; deskLinked: boolean }) {
  const { t, lang, api, setMe, errorMsg, tailor, profile, deskLinked } = p;
  const x = getTailorDict(lang).account;
  const L = lang === "fr" ? "fr" : "en";
  const a = useAction(errorMsg);
  const base = tailorFromAnswers(tailor.answers, { deskLinked });
  const flip = (k: TailorFeature, v: boolean) =>
    void a.run(async () => {
      const o = { ...tailor.overrides };
      if (v === base.features[k]) delete o[k];
      else o[k] = v;
      setMe(await api.patchMe({ prefs: { tailor: nextTailorPrefs(tailor, { overrides: o }) } }));
    }, t.saved);
  return (
    <Section
      id="your-vvake"
      kicker={tailorText("tailor.title", L)}
      title={tailorText("tailor.title", L)}
      lead={x.lead}
      nav={tailorText("tailor.title", L)}
    >
      <div className="mt-8 max-w-2xl">
        <Card title={x.profile} lead={TAILOR_PRESET_TEXT[profile.preset][L]}>
          {TAILOR_FEATURES.map((k) => (
            <Row
              key={k}
              label={TAILOR_FEATURE_NAMES[k][L]}
              hint={k === "rewards" ? tailorText("tailor.summary.rewardsHint", L) : undefined}
            >
              <Toggle checked={profile.features[k]} onChange={(v) => flip(k, v)} label={TAILOR_FEATURE_NAMES[k][L]} disabled={a.busy} />
            </Row>
          ))}
          {a.status}
          <a
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
            href={`/${lang}/app/#/your-vvake`}
          >
            {x.answers}
          </a>
        </Card>
      </div>
    </Section>
  );
}

/** The sections of features that are off, folded at the bottom of the page (nothing removed). */
export function OffSections({ lang, count, children }: { lang: PanelProps["lang"]; count: number; children: ReactNode }) {
  const x = getTailorDict(lang).account;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Section id="all-features" kicker={x.allFeatures} title={x.allFeatures} lead={x.allFeaturesLead} nav={x.allFeatures}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-8 inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-semibold hover:border-muted"
        >
          {open ? "−" : "+"} {format(x.show, { n: count })}
        </button>
      </Section>
      {open && children}
    </>
  );
}
