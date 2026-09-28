import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { locales } from "@/i18n/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "privacy/"];
  return pages.flatMap((page) =>
    locales.map((lang) => ({
      url: `${siteConfig.url}/${lang}/${page}`,
      changeFrequency: "weekly" as const,
      priority: page === "" ? 1 : 0.3,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${siteConfig.url}/${l}/${page}`])) },
    })),
  );
}
