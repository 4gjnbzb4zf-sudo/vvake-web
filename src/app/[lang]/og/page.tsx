import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container } from "@/components/ui/Section";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatUnits } from "@/lib/eth";
import { ogRows, parseOgList } from "@/lib/ogClaim";
import { explorerAddress, ogClaimConfig, rewardsConfig } from "@/lib/rewards-config";
import listJson from "../../../../public/og-drop/og-drop-claims.json";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).ogList;
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: `/${lang}/og/`, languages: Object.fromEntries(locales.map((l) => [l, `/${l}/og/`])) },
  };
}

/** vvake.com/og: the OG v1 holders claim list, every wallet and its amount, rendered at build time from the published JSON. */
export default async function OgListPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.ogList;
  const list = parseOgList(listJson);
  if (!list) throw new Error("public/og-drop/og-drop-claims.json is not a valid OG list");
  const rows = ogRows(list);
  const amount = (wei: bigint) => formatUnits(wei, rewardsConfig.decimals, 2, lang);
  const total = rows.reduce((s, r) => s + r.amount, 0n);
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={t.kicker} title={t.heading} lead={t.lead} />
        <Container className="py-12 sm:py-16">
          <p className="rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{dict.ogClaim.testnet}</p>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">{t.rules}</p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface/60 p-4">
              <dt className="text-faint">{t.snapshot}</dt>
              <dd className="mt-1 font-mono text-text">{list.snapshotBlock}</dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/60 p-4 sm:col-span-2">
              <dt className="text-faint">{t.root}</dt>
              <dd className="mt-1 font-mono text-xs break-all text-text">{list.root}</dd>
            </div>
          </dl>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="text-faint">{t.files}:</span>
            <a href={ogClaimConfig.csvUrl} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {t.csv}
            </a>
            <a href={ogClaimConfig.listUrl} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {t.json}
            </a>
            <a href={`/${lang}/rewards/#og`} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {t.claimLink}
            </a>
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/80 text-faint">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t.rank}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t.address}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.address} className="border-t border-line/60">
                    <td className="px-4 py-2 font-mono text-faint">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <a
                        href={explorerAddress(r.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all hover:text-pulse-fg"
                      >
                        {r.address}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{amount(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-surface/60 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>
                    {t.total} · {rows.length}
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap">{amount(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}
