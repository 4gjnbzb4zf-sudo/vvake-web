import { Section } from "@/components/ui/Section";
import { siteConfig } from "@/config/site";
import type { Dictionary } from "@/i18n/dictionaries";
import { CITIES } from "@/lib/cities";
import { MAP_WIDTH, worldDotMap } from "@/lib/worldDots";
import { LiveMap, type MapCity } from "./LiveMap";

/** Server component: projects the world and the cities at build time, then hands plain numbers to the client map. */
export function Live({ dict, index, numberLocale }: { dict: Dictionary["live"]; index: string; numberLocale: string }) {
  const all = [...CITIES.values()];
  const { dots, places, height } = worldDotMap(all.map((c) => ({ id: c.slug, lat: c.lat, lon: c.lon })));
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const cities: MapCity[] = places.map((p) => {
    const c = bySlug.get(p.id)!;
    return { slug: c.slug, name: c.name, x: p.x, y: p.y, metroPopulation: c.metroPopulation, lon: c.lon };
  });
  return (
    <Section id="live" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <LiveMap
        dict={dict}
        dots={dots}
        cities={cities}
        width={MAP_WIDTH}
        height={height}
        endpoint={siteConfig.liveEndpoint}
        numberLocale={numberLocale}
      />
    </Section>
  );
}
