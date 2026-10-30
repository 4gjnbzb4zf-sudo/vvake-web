import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TalkForward } from "@/components/webapp/TalkForward";
import { isLocale } from "@/i18n/config";
import { getTalkDict } from "@/i18n/talk";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: { absolute: `${getTalkDict(lang).button} · VVake` }, robots: { index: false, follow: true } };
}

/**
 * vvake.com/<lang>/app/talk/ (VVFit ADR-0068, game-core TALK_ROUTE): "Talk to your coach" from anywhere (a shortcut,
 * a link). The site is static, so the page forwards to /<lang>/app/#/talk, keeping `?live=0` (push-to-talk).
 */
export default async function TalkPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <TalkForward lang={lang} label={getTalkDict(lang).button} />;
}
