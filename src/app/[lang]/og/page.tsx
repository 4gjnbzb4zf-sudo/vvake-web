import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/Extras";
import { Header } from "@/components/sections/Header";
import { PageIntro } from "@/components/sections/PageIntro";
import { Container } from "@/components/ui/Section";
import { isLocale, locales } from "@/i18n/config";
import { format, getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { formatUnits } from "@/lib/eth";
import { ogRows, parseOgList } from "@/lib/ogClaim";
import { explorerAddress, explorerTx, holdersDropConfig, ogClaimConfig, rewardsConfig, shortHex } from "@/lib/rewards-config";
import listJson from "../../../../public/og-drop/og-drop-claims.json";
import holdersJson from "../../../../public/holders-drop/holders-drop-claims.json";

/** Drop 2 has 3,199 wallets: the page shows the largest ones; the CSV, the JSON and the lookup have them all. */
const HOLDERS_SHOWN = 100;

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

/**
 * vvake.com/og: the two $VVAKE v2 drop lists, rendered at build time from the published JSON: drop 1 (74 v1 buyers,
 * every wallet, sent) and drop 2 (3,199 free v1 holders, the largest shown, all in the files).
 */
export default async function OgListPage({ params }: { params: Params }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.ogList;
  const list = parseOgList(listJson);
  if (!list) throw new Error("public/og-drop/og-drop-claims.json is not a valid OG list");
  const holders = parseOgList(holdersJson);
  if (!holders) throw new Error("public/holders-drop/holders-drop-claims.json is not a valid list");
  const rows = ogRows(list);
  const holderRows = ogRows(holders);
  const amount = (wei: bigint) => formatUnits(wei, rewardsConfig.decimals, 2, lang);
  const total = rows.reduce((s, r) => s + r.amount, 0n);
  const holdersTotal = holderRows.reduce((s, r) => s + r.amount, 0n);
  const link = "text-text underline underline-offset-4 hover:text-pulse-fg";
  return (
    <>
      <Header locale={lang} dict={dict.nav} />
      <main id="main">
        <PageIntro kicker={t.kicker} title={t.heading} lead={t.lead} />
        <Container className="py-12 sm:py-16">
          <p className="rounded-xl border border-butter-fg/30 bg-butter/10 px-4 py-3 text-sm text-butter-fg">{dict.ogClaim.testnet}</p>
          <h2 id="buyers" className="mt-10 font-display text-2xl font-semibold">
            {t.drop1}
          </h2>
          <p className="mt-4 text-sm font-semibold text-mint-fg">
            {format(dict.ogClaim.drop1.status, {
              date: new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(
                new Date(`${ogClaimConfig.paidAt}T12:00:00Z`),
              ),
            })}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{t.rules}</p>
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
            <a href={ogClaimConfig.paidCsvUrl} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {t.paidCsv}
            </a>
            <a
              href={explorerAddress(ogClaimConfig.address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text underline underline-offset-4 hover:text-pulse-fg"
            >
              {dict.ogClaim.contract}
            </a>
            <a href={`/${lang}/rewards/#og`} className="text-text underline underline-offset-4 hover:text-pulse-fg">
              {t.claimLink}
            </a>
          </p>
          <DropTable rows={rows} start={0} footer={`${t.total} · ${rows.length}`} total={amount(total)} amount={amount} t={t} />
          <h2 id="holders" className="mt-16 font-display text-2xl font-semibold">
            {t.drop2}
          </h2>
          <p className="mt-4 text-sm font-semibold text-text">
            {holdersDropConfig.status === "sent" ? dict.ogClaim.drop2.sent : dict.ogClaim.drop2.sending}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{t.rules2}</p>
          <ul className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed text-muted">
            {dict.ogClaim.drop2.why.map((w) => (
              <li key={w}>
                <span className="mr-2 text-volt-fg">→</span>
                {w}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {format(dict.ogClaim.drop2.reserve, { reserve: new Intl.NumberFormat(lang).format(holdersDropConfig.reserveLeft) })}
          </p>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface/60 p-4">
              <dt className="text-faint">{dict.ogClaim.contract}</dt>
              <dd className="mt-1 font-mono text-xs break-all">
                <a href={explorerAddress(holdersDropConfig.address)} target="_blank" rel="noopener noreferrer" className={link}>
                  {holdersDropConfig.address}
                </a>
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/60 p-4">
              <dt className="text-faint">{dict.ogClaim.drop2.fundingTx}</dt>
              <dd className="mt-1 font-mono text-xs break-all">
                <a href={explorerTx(holdersDropConfig.fundingTx)} target="_blank" rel="noopener noreferrer" className={link}>
                  {shortHex(holdersDropConfig.fundingTx, 14, 10)}
                </a>
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface/60 p-4">
              <dt className="text-faint">{t.root}</dt>
              <dd className="mt-1 font-mono text-xs break-all text-text">{holders.root}</dd>
            </div>
          </dl>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="text-faint">{t.files}:</span>
            <a href={holdersDropConfig.csvUrl} className={link}>
              {t.csv}
            </a>
            <a href={holdersDropConfig.listUrl} className={link}>
              {t.json}
            </a>
            <a href={`/${lang}/rewards/#og`} className={link}>
              {t.claimLink}
            </a>
          </p>
          <p className="mt-4 text-sm text-muted">{format(t.top, { shown: HOLDERS_SHOWN, count: holderRows.length })}</p>
          <DropTable
            rows={holderRows.slice(0, HOLDERS_SHOWN)}
            start={0}
            footer={`${t.total} · ${holderRows.length}`}
            total={amount(holdersTotal)}
            amount={amount}
            t={t}
          />
        </Container>
      </main>
      <Footer locale={lang} dict={dict.footer} />
    </>
  );
}

function DropTable({
  rows,
  start,
  footer,
  total,
  amount,
  t,
}: {
  rows: { address: string; amount: bigint }[];
  start: number;
  footer: string;
  total: string;
  amount: (wei: bigint) => string;
  t: Dictionary["ogList"];
}) {
  return (
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
              <td className="px-4 py-2 font-mono text-faint">{start + i + 1}</td>
              <td className="px-4 py-2 font-mono text-xs">
                <a href={explorerAddress(r.address)} target="_blank" rel="noopener noreferrer" className="break-all hover:text-pulse-fg">
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
              {footer}
            </td>
            <td className="px-4 py-3 text-right font-mono whitespace-nowrap">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
