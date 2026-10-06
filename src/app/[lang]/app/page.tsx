import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPreview } from "@/components/sections/AppPreview";
import { AppScreens } from "@/components/sections/AppScreens";
import { Challenges } from "@/components/sections/Challenges";
import { Coach } from "@/components/sections/Coach";
import { Crew } from "@/components/sections/Crew";
import { Dare } from "@/components/sections/Dare";
import { DayLoop } from "@/components/sections/DayLoop";
import { Earn } from "@/components/sections/Earn";
import { GhostModes } from "@/components/sections/GhostModes";
import { How } from "@/components/sections/How";
import { Journal } from "@/components/sections/Journal";
import { Live } from "@/components/sections/Live";
import { Multisport } from "@/components/sections/Multisport";
import { Pace } from "@/components/sections/Pace";
import { People } from "@/components/sections/People";
import { Planner } from "@/components/sections/Planner";
import { Plus } from "@/components/sections/Plus";
import { RivalryBoard, type RivalryView } from "@/components/sections/Rivalries";
import { Showcase } from "@/components/sections/Showcase";
import { Unlock } from "@/components/sections/Unlock";
import { Wellbeing } from "@/components/sections/Wellbeing";
import { Why } from "@/components/sections/Why";
import { Section } from "@/components/ui/Section";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCity, RIVALRIES, thresholdFor } from "@/lib/cities";
import { Subpage, subpageMetadata } from "../subpage";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? subpageMetadata(lang, "app/") : {};
}

function rivalryViews(): RivalryView[] {
  return RIVALRIES.map((r) => {
    const side = (slug: string) => ({ name: getCity(slug)?.name ?? slug, threshold: thresholdFor(slug) });
    return { id: r.id as RivalryView["id"], country: r.country, sides: [side(r.cities[0]), side(r.cities[1])] as const };
  });
}

/** The app in depth: the plan, the coach call, the app itself, a day, every sport, rewards, competing, crews, your city, wellbeing, Plus. */
export default async function AppPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <Subpage lang={lang} page="app/">
      <Section id="plan" index="01" kicker={dict.plan.kicker} title={dict.plan.title} lead={dict.plan.body}>
        <Planner dict={dict.plan} sportNames={dict.multisport.sports} />
      </Section>
      <Coach dict={dict.coach} index="02" />
      <AppPreview locale={lang} dict={dict.app} index="03" />
      <AppScreens dict={dict.screens} />
      <How dict={dict.how} index="04" />
      <DayLoop dict={dict.day} index="05" />
      <Multisport dict={dict.multisport} index="06" locale={lang} />
      <Why dict={dict.why} index="07" />
      <Earn locale={lang} dict={dict.earn} index="08" />
      <Showcase locale={lang} dict={dict.showcase} />
      <Challenges dict={dict.challenges} index="09" />
      <Dare dict={dict.dare} index="10" />
      <GhostModes dict={dict.ghostModes} index="11" />
      <Pace dict={dict.pace} index="12" />
      <Crew dict={dict.crew} index="13" />
      <People dict={dict.people} index="14" />
      <Section
        id="rivalries"
        index="15"
        kicker={dict.rivalries.kicker}
        title={<span className="inline-block -skew-x-6 italic">{dict.rivalries.title}</span>}
        lead={dict.rivalries.body}
      >
        <RivalryBoard dict={dict.rivalries} rivalries={rivalryViews()} numberLocale={lang} />
      </Section>
      <Live dict={dict.live} index="16" numberLocale={lang} />
      <Wellbeing dict={dict.wellbeing} index="17" />
      <Section id="journal" index="18" kicker={dict.journal.kicker} title={dict.journal.title} lead={dict.journal.body}>
        <Journal dict={dict.journal} />
      </Section>
      <Plus dict={dict.plus} index="19" />
      <Unlock locale={lang} dict={dict.unlock} countryLabels={dict.rivalries.tabs} index="20" />
    </Subpage>
  );
}
