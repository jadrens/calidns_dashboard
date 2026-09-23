// DNS Manager — shared types matching the DNS Server API

export interface DnsRecordSet {
  a?: string[];
  aaaa?: string[];
  txt?: string[];
  cname?: string[];
  mx?: string[];
  ns?: string[];
  srv?: string[];
  caa?: string[];
  ptr?: string[];
  soa?: string[];
  other?: string[];
}

export interface ZoneCountries {
  [countryCode: string]: DnsRecordSet;
}

export interface Zone {
  pattern: string;
  regex: string;
  mode: "simple" | "golang";
  countries: ZoneCountries;
  ttl: number;
  record: boolean;
  fast_open: boolean;
}

export interface ZoneListResponse {
  total: number;
  zones: Zone[];
}

export interface ZoneActionResponse {
  status: string;
  pattern: string;
  country?: string;
}

export interface StatsResponse {
  zones: number;
  recorder:
    | { enabled: false }
    | {
        queue_len: number;
        total_queries: number;
        cache_hited: number;
        dropped: number;
      };
}

export interface HealthResponse {
  status: string;
}

export interface QueryItem {
  id?: number;
  domain: string;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  geo_cached?: boolean;
  asn?: string;
  as_name?: string;
  server_hostname: string;
  edns_subnet?: string;
  edns_country_code?: string;
  edns_city?: string;
  edns_asn?: string;
  edns_as_name?: string;
  nsid?: string;
  created_at: string;
}

export interface EdnsItem {
  id: number;
  domain: string;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  server_hostname: string;
  subnet: string;
  edns_country_code: string;
  edns_city: string;
  edns_asn: string;
  edns_as_name: string;
  nsid: string;
  created_at: string;
}

export interface EdnsListResponse {
  total: number;
  items: EdnsItem[];
}

export interface EdnsDeleteResponse {
  status: string;
  deleted: number;
}

export interface GeoCacheEntry {
  subnet: string;
  country_code: string;
  city: string;
  asn?: string;
  as_name?: string;
  expires_at: string;
}

export interface GeoCacheListResponse {
  total: number;
  entries: GeoCacheEntry[];
}

export interface GeoCacheDeleteResponse {
  status: string;
  subnet: string;
  deleted: number;
}

export interface QueryListResponse {
  total: number;
  items: QueryItem[];
}

export interface QueryDeleteResponse {
  status: string;
  domain: string;
  deleted: number;
}

export interface ApiError {
  error: string;
}

export interface ServerConfig {
  listen: string[];
  default_ttl: number;
  default_response: "refuse" | "nxdomain" | "servfail";
  default_record: boolean;
}

export interface ServerConfigUpdate {
  default_ttl?: number;
  default_response?: "refuse" | "nxdomain" | "servfail";
  default_record?: boolean;
}

export interface ServerConfigResponse {
  status: string;
}

export interface ClusterSnapshot {
  hash: string;
  record_count: number;
  updated_at: string;
}

export interface ClusterSyncStatus {
  success: boolean;
  full_sync: boolean;
  changed: boolean;
  checked_at: string;
  last_success_at?: string;
  duration_ms: number;
  master_hash?: string;
  record_count: number;
  error?: string;
}

export interface ClusterPeerStatus {
  address: string;
  online: boolean;
  checked_at?: string;
  duration_ms: number;
  error?: string;
}

export interface ClusterStatus {
  mode: "master" | "slave" | "";
  snapshot: ClusterSnapshot;
  master?: string;
  sync?: ClusterSyncStatus;
  slaves?: ClusterPeerStatus[];
  online: number;
  total: number;
  interval: string;
}

export interface ClusterEvent {
  kind: "sync" | "health";
  peer?: string;
  success: boolean;
  full_sync?: boolean;
  changed?: boolean;
  occurred_at: string;
  duration_ms: number;
  hash?: string;
  record_count?: number;
  error?: string;
}

export interface ClusterHistory {
  mode: "master" | "slave" | "";
  events: ClusterEvent[];
}
