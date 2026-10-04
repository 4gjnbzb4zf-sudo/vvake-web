import type { Locale } from "@/i18n/config";

/** The site's pages: a short home page and three deeper pages (everything that used to be one long page). */
export const PAGES = ["", "app/", "vvaker/", "backers/"] as const;
export type Page = (typeof PAGES)[number];

/** Which page each linkable section lives on. `unlock` (the waitlist) closes every page, so it stays in place. */
const SECTION_PAGE: Record<string, Page> = {
  coach: "app/",
  faq: "",
  why: "app/",
  plan: "app/",
  app: "app/",
  how: "app/",
  day: "app/",
  multisport: "app/",
  earn: "app/",
  challenges: "app/",
  dare: "app/",
  pace: "app/",
  crew: "app/",
  people: "app/",
  rivalries: "app/",
  live: "app/",
  wellbeing: "app/",
  journal: "app/",
  plus: "app/",
  vvaker: "vvaker/",
  grow: "vvaker/",
  collector: "vvaker/",
  story: "backers/",
  pulse: "backers/",
  rwa: "backers/",
  "open-book": "backers/",
  dev: "backers/",
  partners: "backers/",
};

export const pageHref = (locale: Locale, page: Page) => `/${locale}/${page}`;

/** Link to a section wherever it lives (`#unlock` and unknown ids stay on the current page). */
export function sectionHref(locale: Locale, id: string): string {
  const page = SECTION_PAGE[id];
  return page === undefined ? `#${id}` : `/${locale}/${page}#${id}`;
}
