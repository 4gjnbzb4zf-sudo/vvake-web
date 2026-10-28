// Cut from VVFit packages/game-core/src/calendar.ts (c66de39e 2026-09-28) by scripts/sync-living-core.ts. Do not edit: re-sync.
/** RFC 5545 TEXT escaping. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1), without splitting a UTF-8 character. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
