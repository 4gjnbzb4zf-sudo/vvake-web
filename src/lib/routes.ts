import type { Locale } from "@/i18n/config";

/** The site's pages: a short home page and three deeper pages (everything that used to be one long page). */
export const PAGES = ["", "tour/", "vvaker/", "backers/"] as const;
export type Page = (typeof PAGES)[number];

/** Which page each linkable section lives on. `unlock` (the waitlist) closes every page, so it stays in place. */
const SECTION_PAGE: Record<string, Page> = {
  coach: "tour/",
  faq: "",
  why: "tour/",
  plan: "tour/",
  app: "tour/",
  how: "tour/",
  day: "tour/",
  multisport: "tour/",
  earn: "tour/",
  challenges: "tour/",
  dare: "tour/",
  pace: "tour/",
  crew: "tour/",
  people: "tour/",
  rivalries: "tour/",
  live: "tour/",
  wellbeing: "tour/",
  journal: "tour/",
  plus: "tour/",
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

/** The section ids of the app's tour (/<lang>/tour/), which lived at /<lang>/app/ before the web app took that address. */
export const TOUR_SECTIONS: readonly string[] = [
  ...Object.entries(SECTION_PAGE)
    .filter(([, p]) => p === "tour/")
    .map(([id]) => id),
  "screens",
];
