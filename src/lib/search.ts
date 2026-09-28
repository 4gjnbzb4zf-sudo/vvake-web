/** Lowercase, trimmed, accent-free: "Québec" and "quebec" match. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export interface Searchable {
  name: string;
}

/**
 * Ranks items for a query: names starting with the query first, then word-starts
 * ("saint" → "Saint-Étienne", "bay" → "Green Bay"), then any substring. Stable within each group.
 */
export function searchByName<T extends Searchable>(items: readonly T[], query: string, limit = 8): T[] {
  const q = normalizeText(query);
  if (!q) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const name = normalizeText(item.name);
    const words = name.split(/[\s\-–.]+/);
    const score = name.startsWith(q) ? 0 : words.some((w) => w.startsWith(q)) ? 1 : name.includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.item);
}

/** True when the query exactly names one of the items (ignoring case and accents). */
export function hasExactMatch(items: readonly Searchable[], query: string): boolean {
  const q = normalizeText(query);
  return items.some((i) => normalizeText(i.name) === q);
}
