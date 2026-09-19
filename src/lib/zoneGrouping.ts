/**
 * Return a readable DNS suffix for a zone pattern.
 *
 * Zone patterns are normally Go regular expressions (for example
 * `^www\.example\.com\.?$`). Grouping is intentionally based only on their
 * literal labels; regex-only fragments such as `(.*\.)?` are ignored.
 */
export function getZoneDepthGroup(pattern: string, depth: number): string {
  const labels = pattern
    .trim()
    .toLowerCase()
    .replace(/\\\./g, ".")
    .split(".")
    .map((label) => label.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);

  if (labels.length === 0) return pattern.trim() || "(empty)";

  const safeDepth = Math.max(1, Math.floor(depth));
  return labels.slice(-safeDepth).join(".");
}
