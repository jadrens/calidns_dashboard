function zoneLabels(pattern: string): string[] {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/\\\./g, ".")
    .split(".")
    .map((label) => label.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
}

/**
 * Return a readable DNS suffix for a zone pattern.
 *
 * Zone patterns are normally Go regular expressions (for example
 * `^www\.example\.com\.?$`). Grouping is intentionally based only on their
 * literal labels; regex-only fragments such as `(.*\.)?` are ignored.
 */
export function getZoneDepthGroup(pattern: string, depth: number): string {
  const labels = zoneLabels(pattern);

  if (labels.length === 0) return pattern.trim() || "(empty)";

  const safeDepth = Math.max(1, Math.floor(depth));
  return labels.slice(-safeDepth).join(".");
}

/**
 * Suggest full domains for the zone editor by completing what the user has
 * typed with parent domains already used by saved zones.
 *
 * Typing `_esaauth` (or `_esaauth.ja`) against a saved `www.jadren.cn`
 * suggests `_esaauth.jadren.cn`. Parents used by more zones rank first, and
 * domains that already exist as zones are skipped.
 */
export function suggestZoneDomains(input: string, savedPatterns: readonly string[], limit = 8): string[] {
  const typed = input.trim().toLowerCase().replace(/\.$/, "");
  if (!typed) return [];

  const existing = new Set<string>();
  const parentCounts = new Map<string, number>();
  for (const pattern of savedPatterns) {
    const labels = zoneLabels(pattern);
    if (labels.length === 0) continue;
    existing.add(labels.join("."));
    // Every parent with at least two labels, plus the domain itself so new
    // names can nest under it.
    for (let start = 0; start <= labels.length - 2; start++) {
      const parent = labels.slice(start).join(".");
      parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
    }
  }

  const parents = [...parentCounts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || a.length - b.length || a.localeCompare(b))
    .map(([parent]) => parent);

  // Split the input at each dot: the head is the new name, the tail is a
  // partially typed parent. With no dot the whole input is the head.
  const splits: Array<[string, string]> = typed.includes(".") ? [] : [[typed, ""]];
  for (let i = typed.indexOf("."); i !== -1; i = typed.indexOf(".", i + 1)) {
    if (i > 0) splits.push([typed.slice(0, i), typed.slice(i + 1)]);
  }

  const results: string[] = [];
  const seen = new Set<string>();
  for (const parent of parents) {
    for (const [head, tail] of splits) {
      if (!parent.startsWith(tail)) continue;
      const candidate = `${head}.${parent}`;
      if (candidate === typed || seen.has(candidate) || existing.has(candidate)) continue;
      seen.add(candidate);
      results.push(candidate);
    }
    if (results.length >= limit) break;
  }
  return results.slice(0, limit);
}
