/**
 * IPv4 validation: checks that each octet is in the range 0-255.
 * Accepts standard dotted-decimal format only, e.g. "192.168.1.1".
 */
export function isValidIPv4(value: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  return ipv4Regex.test(value);
}

/**
 * IPv6 validation: accepts full, compressed (::), and embedded-IPv4 formats.
 * Examples: "::1", "2001:db8::ff00:42:8329", "::ffff:192.0.2.128"
 */
export function isValidIPv6(value: string): boolean {
  // Strip zone ID (e.g. %eth0)
  const stripped = value.replace(/%.*$/, "");

  // Embedded IPv4 at the end: ::ffff:192.0.2.128
  const ipv4EmbeddedRegex =
    /^(?:(?:[0-9a-fA-F]{1,4}:){1,6}|:)(?::(?:[0-9a-fA-F]{1,4}:){0,4})?::?ffff:(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (ipv4EmbeddedRegex.test(stripped)) return true;

  // Pure IPv6: 2-8 colon-separated hex groups, with at most one "::"
  // Must have exactly one "::" if compressed, or exactly 8 groups if not
  if (/::/.test(stripped)) {
    // Compressed form — must contain exactly one "::"
    if ((stripped.match(/::/g) || []).length > 1) return false;
    const ipv6CompressedRegex =
      /^(?:(?:[0-9a-fA-F]{1,4}:){1,7}|:)(?::(?:[0-9a-fA-F]{1,4}){0,6})?$/;
    return ipv6CompressedRegex.test(stripped);
  }

  // Full form: exactly 8 groups
  const ipv6FullRegex =
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6FullRegex.test(stripped);
}

/**
 * Validates a record value based on its record type.
 * Returns an error message string if invalid, or null if valid.
 * Non-IP types (txt, cname) always pass validation.
 */
export function validateRecordValue(
  type: string,
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // empty is allowed (will be filtered on save)

  switch (type) {
    case "a":
      if (!isValidIPv4(trimmed)) {
        return `Invalid IPv4 address: "${trimmed}"`;
      }
      break;
    case "aaaa":
      if (!isValidIPv6(trimmed)) {
        return `Invalid IPv6 address: "${trimmed}"`;
      }
      break;
    default:
      break;
  }
  return null;
}
