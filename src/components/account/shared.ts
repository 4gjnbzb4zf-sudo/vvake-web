import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/dictionaries";
import type { AccountDict } from "@/i18n/account";
import type { AccountApi, Me } from "@/lib/accountApi";
import type { visitorDatePrefs } from "@/lib/dates";
import type { RewardsSession } from "@/lib/rewardsApi";

/** What every panel gets: the API, the copy, how to show dates, the account and a way to update it. */
export interface PanelProps {
  api: AccountApi;
  session: RewardsSession;
  t: AccountDict;
  lang: Locale;
  me: Me;
  setMe: (me: Me) => void;
  /** The account's date and time formats (You → Settings), else the browser's. */
  dates: ReturnType<typeof visitorDatePrefs>;
  errorMsg: (e: unknown) => string;
}

/** The page's sections, in order (the numbers and the "on this page" list). */
export const ACCOUNT_SECTIONS = [
  "profile",
  "app",
  "reminders",
  "plan",
  "coach",
  "health",
  "zones",
  "goals",
  "connections",
  "pulse",
  "plus",
  "data",
] as const;
export type AccountSectionKey = (typeof ACCOUNT_SECTIONS)[number];
export const sectionIndex = (k: AccountSectionKey) => String(ACCOUNT_SECTIONS.indexOf(k) + 1).padStart(2, "0");

/** "{n} min". */
export const mins = (t: AccountDict, n: number) => format(t.minutes, { n });

/** The browser's IANA time zone (UTC when it can't say). */
export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** This page's address without query or hash: where OAuth flows come back to. */
export const pageUrl = () => `${window.location.origin}${window.location.pathname}`;
