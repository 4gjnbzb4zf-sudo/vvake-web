import { cityUnlockThreshold } from "./unlock";

export type Country = "FR" | "US";

export interface City {
  slug: string;
  name: string;
  country: Country;
  /** Approximate metro / urban-area population (INSEE aires d'attraction, US Census MSA). */
  metroPopulation: number;
}

export interface Rivalry {
  id: string;
  country: Country;
  /** Home city slug first, rival second. */
  cities: readonly [string, string];
}

const CITY_LIST: readonly City[] = [
  { slug: "paris", name: "Paris", country: "FR", metroPopulation: 13_100_000 },
  { slug: "marseille", name: "Marseille", country: "FR", metroPopulation: 1_900_000 },
  { slug: "lyon", name: "Lyon", country: "FR", metroPopulation: 2_300_000 },
  { slug: "saint-etienne", name: "Saint-Étienne", country: "FR", metroPopulation: 530_000 },
  { slug: "lille", name: "Lille", country: "FR", metroPopulation: 1_500_000 },
  { slug: "lens", name: "Lens", country: "FR", metroPopulation: 500_000 },
  { slug: "bordeaux", name: "Bordeaux", country: "FR", metroPopulation: 1_400_000 },
  { slug: "toulouse", name: "Toulouse", country: "FR", metroPopulation: 1_500_000 },
  { slug: "nantes", name: "Nantes", country: "FR", metroPopulation: 1_000_000 },
  { slug: "rennes", name: "Rennes", country: "FR", metroPopulation: 770_000 },
  { slug: "montpellier", name: "Montpellier", country: "FR", metroPopulation: 800_000 },
  { slug: "nimes", name: "Nîmes", country: "FR", metroPopulation: 370_000 },
  { slug: "strasbourg", name: "Strasbourg", country: "FR", metroPopulation: 860_000 },
  { slug: "metz", name: "Metz", country: "FR", metroPopulation: 390_000 },
  { slug: "nice", name: "Nice", country: "FR", metroPopulation: 620_000 },
  { slug: "toulon", name: "Toulon", country: "FR", metroPopulation: 580_000 },
  { slug: "new-york", name: "New York", country: "US", metroPopulation: 19_500_000 },
  { slug: "boston", name: "Boston", country: "US", metroPopulation: 4_900_000 },
  { slug: "los-angeles", name: "Los Angeles", country: "US", metroPopulation: 12_800_000 },
  { slug: "san-francisco", name: "San Francisco Bay", country: "US", metroPopulation: 4_600_000 },
  { slug: "chicago", name: "Chicago", country: "US", metroPopulation: 9_300_000 },
  { slug: "st-louis", name: "St. Louis", country: "US", metroPopulation: 2_800_000 },
  { slug: "dallas", name: "Dallas–Fort Worth", country: "US", metroPopulation: 8_100_000 },
  { slug: "houston", name: "Houston", country: "US", metroPopulation: 7_500_000 },
  { slug: "philadelphia", name: "Philadelphia", country: "US", metroPopulation: 6_200_000 },
  { slug: "pittsburgh", name: "Pittsburgh", country: "US", metroPopulation: 2_400_000 },
  { slug: "washington", name: "Washington DC", country: "US", metroPopulation: 6_300_000 },
  { slug: "baltimore", name: "Baltimore", country: "US", metroPopulation: 2_800_000 },
  { slug: "seattle", name: "Seattle", country: "US", metroPopulation: 4_000_000 },
  { slug: "portland", name: "Portland", country: "US", metroPopulation: 2_500_000 },
  { slug: "miami", name: "Miami", country: "US", metroPopulation: 6_100_000 },
  { slug: "tampa", name: "Tampa", country: "US", metroPopulation: 3_300_000 },
  { slug: "minneapolis", name: "Minneapolis", country: "US", metroPopulation: 3_700_000 },
  { slug: "green-bay", name: "Green Bay", country: "US", metroPopulation: 330_000 },
];

export const RIVALRIES: readonly Rivalry[] = [
  { id: "paris-marseille", country: "FR", cities: ["paris", "marseille"] },
  { id: "lyon-saint-etienne", country: "FR", cities: ["lyon", "saint-etienne"] },
  { id: "lille-lens", country: "FR", cities: ["lille", "lens"] },
  { id: "bordeaux-toulouse", country: "FR", cities: ["bordeaux", "toulouse"] },
  { id: "nantes-rennes", country: "FR", cities: ["nantes", "rennes"] },
  { id: "montpellier-nimes", country: "FR", cities: ["montpellier", "nimes"] },
  { id: "strasbourg-metz", country: "FR", cities: ["strasbourg", "metz"] },
  { id: "nice-toulon", country: "FR", cities: ["nice", "toulon"] },
  { id: "new-york-boston", country: "US", cities: ["new-york", "boston"] },
  { id: "los-angeles-san-francisco", country: "US", cities: ["los-angeles", "san-francisco"] },
  { id: "chicago-st-louis", country: "US", cities: ["chicago", "st-louis"] },
  { id: "dallas-houston", country: "US", cities: ["dallas", "houston"] },
  { id: "philadelphia-pittsburgh", country: "US", cities: ["philadelphia", "pittsburgh"] },
  { id: "washington-baltimore", country: "US", cities: ["washington", "baltimore"] },
  { id: "seattle-portland", country: "US", cities: ["seattle", "portland"] },
  { id: "miami-tampa", country: "US", cities: ["miami", "tampa"] },
  { id: "minneapolis-green-bay", country: "US", cities: ["minneapolis", "green-bay"] },
];

export type RivalryId = (typeof RIVALRIES)[number]["id"];

export const CITIES: ReadonlyMap<string, City> = new Map(CITY_LIST.map((c) => [c.slug, c]));
export const CITY_SLUGS = CITY_LIST.map((c) => c.slug) as [string, ...string[]];

export function getCity(slug: string): City | undefined {
  return CITIES.get(slug);
}

export function thresholdFor(slug: string): number {
  const city = CITIES.get(slug);
  if (!city) throw new Error(`Unknown city: ${slug}`);
  return cityUnlockThreshold(city.metroPopulation);
}

export function rivalOf(slug: string): City | undefined {
  const rivalry = RIVALRIES.find((r) => r.cities.includes(slug));
  if (!rivalry) return undefined;
  const other = rivalry.cities[0] === slug ? rivalry.cities[1] : rivalry.cities[0];
  return CITIES.get(other);
}

export function citiesByCountry(country: Country): City[] {
  return CITY_LIST.filter((c) => c.country === country).toSorted((a, b) => a.name.localeCompare(b.name));
}
