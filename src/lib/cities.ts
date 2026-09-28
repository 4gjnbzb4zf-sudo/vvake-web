import { cityUnlockThreshold } from "./unlock";

export type Country = "FR" | "US" | "CA";

/** Display order of launch countries (tabs, grouped lists). */
export const COUNTRIES: readonly Country[] = ["FR", "US", "CA"];

export interface City {
  slug: string;
  name: string;
  country: Country;
  /** Approximate metro / urban-area population (INSEE aires d'attraction, US Census MSA, StatCan CMA). */
  metroPopulation: number;
  /** City center (approximate), used for the live map. */
  lat: number;
  lon: number;
}

export interface Rivalry {
  id: string;
  country: Country;
  /** Home city slug first, rival second. */
  cities: readonly [string, string];
}

const CITY_LIST: readonly City[] = [
  { slug: "paris", name: "Paris", country: "FR", metroPopulation: 13_100_000, lat: 48.86, lon: 2.35 },
  { slug: "marseille", name: "Marseille", country: "FR", metroPopulation: 1_900_000, lat: 43.3, lon: 5.37 },
  { slug: "lyon", name: "Lyon", country: "FR", metroPopulation: 2_300_000, lat: 45.76, lon: 4.84 },
  { slug: "saint-etienne", name: "Saint-Étienne", country: "FR", metroPopulation: 530_000, lat: 45.44, lon: 4.39 },
  { slug: "lille", name: "Lille", country: "FR", metroPopulation: 1_500_000, lat: 50.63, lon: 3.06 },
  { slug: "lens", name: "Lens", country: "FR", metroPopulation: 500_000, lat: 50.43, lon: 2.83 },
  { slug: "bordeaux", name: "Bordeaux", country: "FR", metroPopulation: 1_400_000, lat: 44.84, lon: -0.58 },
  { slug: "toulouse", name: "Toulouse", country: "FR", metroPopulation: 1_500_000, lat: 43.6, lon: 1.44 },
  { slug: "nantes", name: "Nantes", country: "FR", metroPopulation: 1_000_000, lat: 47.22, lon: -1.55 },
  { slug: "rennes", name: "Rennes", country: "FR", metroPopulation: 770_000, lat: 48.11, lon: -1.68 },
  { slug: "montpellier", name: "Montpellier", country: "FR", metroPopulation: 800_000, lat: 43.61, lon: 3.88 },
  { slug: "nimes", name: "Nîmes", country: "FR", metroPopulation: 370_000, lat: 43.84, lon: 4.36 },
  { slug: "strasbourg", name: "Strasbourg", country: "FR", metroPopulation: 860_000, lat: 48.57, lon: 7.75 },
  { slug: "metz", name: "Metz", country: "FR", metroPopulation: 390_000, lat: 49.12, lon: 6.18 },
  { slug: "nice", name: "Nice", country: "FR", metroPopulation: 620_000, lat: 43.7, lon: 7.27 },
  { slug: "toulon", name: "Toulon", country: "FR", metroPopulation: 580_000, lat: 43.12, lon: 5.93 },
  { slug: "new-york", name: "New York", country: "US", metroPopulation: 19_500_000, lat: 40.71, lon: -74.01 },
  { slug: "boston", name: "Boston", country: "US", metroPopulation: 4_900_000, lat: 42.36, lon: -71.06 },
  { slug: "los-angeles", name: "Los Angeles", country: "US", metroPopulation: 12_800_000, lat: 34.05, lon: -118.24 },
  { slug: "san-francisco", name: "San Francisco Bay", country: "US", metroPopulation: 4_600_000, lat: 37.77, lon: -122.42 },
  { slug: "chicago", name: "Chicago", country: "US", metroPopulation: 9_300_000, lat: 41.88, lon: -87.63 },
  { slug: "st-louis", name: "St. Louis", country: "US", metroPopulation: 2_800_000, lat: 38.63, lon: -90.2 },
  { slug: "dallas", name: "Dallas–Fort Worth", country: "US", metroPopulation: 8_100_000, lat: 32.78, lon: -96.8 },
  { slug: "houston", name: "Houston", country: "US", metroPopulation: 7_500_000, lat: 29.76, lon: -95.37 },
  { slug: "philadelphia", name: "Philadelphia", country: "US", metroPopulation: 6_200_000, lat: 39.95, lon: -75.17 },
  { slug: "pittsburgh", name: "Pittsburgh", country: "US", metroPopulation: 2_400_000, lat: 40.44, lon: -80.0 },
  { slug: "washington", name: "Washington DC", country: "US", metroPopulation: 6_300_000, lat: 38.91, lon: -77.04 },
  { slug: "baltimore", name: "Baltimore", country: "US", metroPopulation: 2_800_000, lat: 39.29, lon: -76.61 },
  { slug: "seattle", name: "Seattle", country: "US", metroPopulation: 4_000_000, lat: 47.61, lon: -122.33 },
  { slug: "portland", name: "Portland", country: "US", metroPopulation: 2_500_000, lat: 45.52, lon: -122.68 },
  { slug: "miami", name: "Miami", country: "US", metroPopulation: 6_100_000, lat: 25.76, lon: -80.19 },
  { slug: "tampa", name: "Tampa", country: "US", metroPopulation: 3_300_000, lat: 27.95, lon: -82.46 },
  { slug: "minneapolis", name: "Minneapolis", country: "US", metroPopulation: 3_700_000, lat: 44.98, lon: -93.27 },
  { slug: "green-bay", name: "Green Bay", country: "US", metroPopulation: 330_000, lat: 44.51, lon: -88.01 },
  { slug: "montreal", name: "Montréal", country: "CA", metroPopulation: 4_500_000, lat: 45.5, lon: -73.57 },
  { slug: "toronto", name: "Toronto", country: "CA", metroPopulation: 7_100_000, lat: 43.65, lon: -79.38 },
  { slug: "calgary", name: "Calgary", country: "CA", metroPopulation: 1_700_000, lat: 51.05, lon: -114.07 },
  { slug: "edmonton", name: "Edmonton", country: "CA", metroPopulation: 1_600_000, lat: 53.55, lon: -113.49 },
  { slug: "ottawa", name: "Ottawa", country: "CA", metroPopulation: 1_500_000, lat: 45.42, lon: -75.7 },
  { slug: "quebec-city", name: "Québec City", country: "CA", metroPopulation: 860_000, lat: 46.81, lon: -71.21 },
  { slug: "winnipeg", name: "Winnipeg", country: "CA", metroPopulation: 900_000, lat: 49.9, lon: -97.14 },
  { slug: "regina", name: "Regina", country: "CA", metroPopulation: 270_000, lat: 50.45, lon: -104.61 },
  { slug: "vancouver", name: "Vancouver", country: "CA", metroPopulation: 3_100_000, lat: 49.28, lon: -123.12 },
  { slug: "victoria", name: "Victoria", country: "CA", metroPopulation: 430_000, lat: 48.43, lon: -123.37 },
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
  { id: "montreal-toronto", country: "CA", cities: ["montreal", "toronto"] },
  { id: "calgary-edmonton", country: "CA", cities: ["calgary", "edmonton"] },
  { id: "ottawa-quebec-city", country: "CA", cities: ["ottawa", "quebec-city"] },
  { id: "winnipeg-regina", country: "CA", cities: ["winnipeg", "regina"] },
  { id: "vancouver-victoria", country: "CA", cities: ["vancouver", "victoria"] },
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
