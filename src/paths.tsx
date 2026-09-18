import { createContext, useContext } from "react";

const originalBase = "/mtools/dns-manager";

export interface DnsLocation {
  basePath: string;
  pathname: string;
}

export const DnsLocationContext = createContext<DnsLocation>({
  basePath: "/",
  pathname: originalBase,
});

export function useDnsLocation() {
  return useContext(DnsLocationContext);
}

export function resolveDnsHref(href: string, basePath: string) {
  const suffix = href.startsWith(originalBase) ? href.slice(originalBase.length) : href;
  const base = basePath.replace(/\/$/, "");
  return `${base}${suffix || "/"}`;
}

export function canonicalDnsPath(pathname: string, basePath: string) {
  const base = basePath.replace(/\/$/, "");
  const suffix = pathname.startsWith(base + "/")
    ? pathname.slice(base.length)
    : pathname === base ? "/" : "/";
  return originalBase + (suffix === "/" ? "" : suffix.replace(/\/$/, ""));
}
