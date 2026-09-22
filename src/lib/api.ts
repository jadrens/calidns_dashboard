// DNS Manager — API service
// All calls go to the configured DNS Server API host with Bearer token auth.

import type {
  Zone,
  ZoneListResponse,
  ZoneActionResponse,
  StatsResponse,
  HealthResponse,
  QueryListResponse,
  QueryDeleteResponse,
  ApiError,
  ServerConfig,
  ServerConfigUpdate,
  ServerConfigResponse,
  GeoCacheListResponse,
  GeoCacheDeleteResponse,
  EdnsListResponse,
  EdnsDeleteResponse,
	ClusterStatus,
	ClusterHistory,
} from "./types";

const STORAGE_KEY_TOKEN = "dns-manager-token";
const STORAGE_KEY_API_BASE = "dns-manager-api-base";

// --- Token helpers (localStorage) ---

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

export function hasToken(): boolean {
  // An API base is sufficient when the server intentionally runs without
  // bearer tokens (development/isolated deployments).
  return !!getApiBase();
}

// --- API base URL helpers (localStorage) ---

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_API_BASE) || "";
}

function normalizeApiBase(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS API endpoint.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname ||
      parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Enter a valid HTTP or HTTPS API endpoint without credentials, query, or fragment.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function setApiBase(url: string): void {
  const normalized = normalizeApiBase(url);
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_API_BASE, normalized);
}

export class ApiEndpointConnectionError extends Error {
  constructor() {
    super("Could not connect to the DNS API over HTTPS or HTTP.");
    this.name = "ApiEndpointConnectionError";
  }
}

/** Select an endpoint without sending a token. Bare hosts try HTTPS, then HTTP. */
export async function resolveApiBase(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("API endpoint cannot be empty.");
  const explicitProtocol = /^https?:\/\//i.test(trimmed);
  if (!explicitProtocol && (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("//"))) {
    throw new Error("Enter a valid HTTP or HTTPS API endpoint.");
  }
  const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i.test(trimmed);
  // Never silently downgrade a public endpoint and later send its bearer
  // token over cleartext HTTP. Local loopback remains convenient for dev.
  const candidates = explicitProtocol ? [trimmed] : [localHost ? `http://${trimmed}` : `https://${trimmed}`];
  let validCandidate = false;

  for (const candidate of candidates) {
    const base = normalizeApiBase(candidate);
    validCandidate = true;
    try {
      const response = await fetch(`${base}/api/health`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "status" in data && typeof data.status === "string") {
        return base;
      }
    } catch {
      // A connection, CORS, timeout, or response failure allows the next protocol.
    }
  }
  if (validCandidate) throw new ApiEndpointConnectionError();
  throw new Error("Enter a valid HTTP or HTTPS API endpoint.");
}

export function resetApiBase(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_API_BASE);
}

// --- Low-level fetch wrapper ---

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiBase = getApiBase();
  if (!apiBase) throw new Error("Set a DNS API endpoint before connecting.");
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Remove so we don't double-merge
  delete (options as Record<string, unknown>).headers;

  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return data as T;
}

// --- Public API methods ---

/** GET /api/health — no auth required */
export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

/** GET /api/stats */
export async function getStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>("/api/stats");
}

/** GET /api/cluster/status — role-aware cluster summary */
export async function getClusterStatus(): Promise<ClusterStatus> {
  return apiFetch<ClusterStatus>("/api/cluster/status", { cache: "no-store" });
}

/** GET /api/cluster/history — bounded process-local check history */
export async function getClusterHistory(): Promise<ClusterHistory> {
  return apiFetch<ClusterHistory>("/api/cluster/history", { cache: "no-store" });
}

/** GET /api/server — get server default config */
export async function getServerConfig(): Promise<ServerConfig> {
  return apiFetch<ServerConfig>("/api/server");
}

/** PUT /api/server — update server default config */
export async function updateServerConfig(
  update: ServerConfigUpdate
): Promise<ServerConfigResponse> {
  return apiFetch<ServerConfigResponse>("/api/server", {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

/** GET /api/zones — list all zones */
export async function listZones(): Promise<ZoneListResponse> {
  return apiFetch<ZoneListResponse>("/api/zones");
}

/** GET /api/zones?pattern=... — get a single zone */
export async function getZone(pattern: string): Promise<Zone> {
  return apiFetch<Zone>(
    `/api/zones?pattern=${encodeURIComponent(pattern)}`
  );
}

/** POST /api/zones — add or update a zone */
export async function saveZone(zone: Zone): Promise<ZoneActionResponse> {
  return apiFetch<ZoneActionResponse>("/api/zones", {
    method: "POST",
    body: JSON.stringify(zone),
  });
}

/** DELETE /api/zones?pattern=... — delete an entire zone */
export async function deleteZone(
  pattern: string
): Promise<ZoneActionResponse> {
  return apiFetch<ZoneActionResponse>(
    `/api/zones?pattern=${encodeURIComponent(pattern)}`,
    { method: "DELETE" }
  );
}

/** DELETE /api/zones?pattern=...&country=... — delete a country from a zone */
export async function deleteZoneCountry(
  pattern: string,
  country: string
): Promise<ZoneActionResponse> {
  return apiFetch<ZoneActionResponse>(
    `/api/zones?pattern=${encodeURIComponent(pattern)}&country=${encodeURIComponent(country)}`,
    { method: "DELETE" }
  );
}

/** GET /api/queries — query DNS history */
export interface QueryParams {
  domain?: string;
  country_code?: string;
  ip?: string;
  subnet?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export async function listQueries(
  params: QueryParams = {}
): Promise<QueryListResponse> {
  const search = new URLSearchParams();
  if (params.domain) search.set("domain", params.domain);
  if (params.country_code) search.set("country_code", params.country_code);
  if (params.ip) search.set("ip", params.ip);
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiFetch<QueryListResponse>(
    `/api/queries${qs ? `?${qs}` : ""}`
  );
}

/** DELETE /api/queries — delete matching records by filter */
export async function deleteQueries(
  params: {
    domain?: string;
    country_code?: string;
    ip?: string;
    subnet?: string;
    start?: string;
    end?: string;
  } = {}
): Promise<QueryDeleteResponse> {
  const search = new URLSearchParams();
  if (params.domain) search.set("domain", params.domain);
  if (params.country_code) search.set("country_code", params.country_code);
  if (params.ip) search.set("ip", params.ip);
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  const qs = search.toString();
  return apiFetch<QueryDeleteResponse>(
    `/api/queries${qs ? `?${qs}` : ""}`,
    { method: "DELETE" }
  );
}

/** DELETE /api/queries?id=... — delete a single query record by ID */
export async function deleteQueryById(
  id: number
): Promise<QueryDeleteResponse> {
  return apiFetch<QueryDeleteResponse>(
    `/api/queries?id=${encodeURIComponent(String(id))}`,
    { method: "DELETE" }
  );
}

/** GET /api/geo-cache — list all valid geo cache entries */
export interface GeoCacheParams {
  subnet?: string;
  country_code?: string;
  limit?: number;
  offset?: number;
}

export async function getGeoCache(
  params: GeoCacheParams = {}
): Promise<GeoCacheListResponse> {
  const search = new URLSearchParams();
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.country_code) search.set("country_code", params.country_code);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiFetch<GeoCacheListResponse>(
    `/api/geo-cache${qs ? `?${qs}` : ""}`
  );
}

/** DELETE /api/geo-cache — delete geo cache entries */
export async function deleteGeoCache(
  params: { subnet?: string; country_code?: string } = {}
): Promise<GeoCacheDeleteResponse> {
  const search = new URLSearchParams();
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.country_code) search.set("country_code", params.country_code);
  const qs = search.toString();
  return apiFetch<GeoCacheDeleteResponse>(
    `/api/geo-cache${qs ? `?${qs}` : ""}`,
    { method: "DELETE" }
  );
}

/** GET /api/edns — query EDNS records */
export interface EdnsParams {
  id?: number;
  subnet?: string;
  country_code?: string;
  nsid?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export async function listEdns(
  params: EdnsParams = {}
): Promise<EdnsListResponse> {
  const search = new URLSearchParams();
  if (params.id != null) search.set("id", String(params.id));
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.country_code) search.set("country_code", params.country_code);
  if (params.nsid) search.set("nsid", params.nsid);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiFetch<EdnsListResponse>(
    `/api/edns${qs ? `?${qs}` : ""}`
  );
}

/** DELETE /api/edns — delete EDNS records */
export async function deleteEdns(
  params: Omit<EdnsParams, "limit" | "offset"> = {}
): Promise<EdnsDeleteResponse> {
  const search = new URLSearchParams();
  if (params.id != null) search.set("id", String(params.id));
  if (params.subnet) search.set("subnet", params.subnet);
  if (params.country_code) search.set("country_code", params.country_code);
  if (params.nsid) search.set("nsid", params.nsid);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  const qs = search.toString();
  return apiFetch<EdnsDeleteResponse>(
    `/api/edns${qs ? `?${qs}` : ""}`,
    { method: "DELETE" }
  );
}
