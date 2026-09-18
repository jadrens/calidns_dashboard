// DNS Manager — shared types matching the DNS Server API

export interface DnsRecordSet {
  a?: string[];
  aaaa?: string[];
  txt?: string[];
  cname?: string[];
}

export interface ZoneCountries {
  [countryCode: string]: DnsRecordSet;
}

export interface Zone {
  pattern: string;
  regex: string;
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
  listen: string;
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
