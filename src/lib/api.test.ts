import { afterEach, describe, expect, test } from "bun:test";
import {
  ApiEndpointConnectionError,
  getStats,
  hasToken,
  listQueries,
  removeToken,
  resolveApiBase,
  setApiBase,
  setToken,
} from "./api";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installBrowserStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = Object.assign(handler, { preconnect: originalFetch.preconnect }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete (globalThis as { window?: unknown }).window;
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("DNS API authentication", () => {
  test("requires a real token instead of treating the endpoint as authentication", () => {
    installBrowserStorage();
    setApiBase("https://dns.example.test");
    expect(hasToken()).toBe(false);
    setToken(" secret-token ");
    expect(hasToken()).toBe(true);
    removeToken();
    expect(hasToken()).toBe(false);
  });

  test("sends the trimmed bearer token on API requests", async () => {
    installBrowserStorage();
    setApiBase("https://dns.example.test");
    setToken(" secret-token ");
    let sentHeaders = new Headers();
    mockFetch(async (_input, init) => {
      sentHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ zones: 0, recorder: { enabled: false } }), { status: 200 });
    });

    await getStats();
    expect(sentHeaders.get("Authorization")).toBe("Bearer secret-token");
    expect(sentHeaders.get("Content-Type")).toBe("application/json");
  });

  test("normalizes query time filters to UTC", async () => {
    installBrowserStorage();
    setApiBase("https://dns.example.test");
    setToken("secret-token");
    let requestURL = "";
    mockFetch(async (input) => {
      requestURL = String(input);
      return new Response(JSON.stringify({ total: 0, items: [] }), { status: 200 });
    });

    await listQueries({ start: "2026-09-24T12:25:26+09:00" });
    expect(new URL(requestURL).searchParams.get("start")).toBe("2026-09-24T03:25:26.000Z");
  });
});

describe("DNS API endpoint resolution", () => {
  test("does not downgrade a bare public host to HTTP", async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    mockFetch(async (input, init) => {
      requests.push({ url: String(input), headers: new Headers(init?.headers) });
      throw new TypeError("HTTPS unavailable");
    });

    await expect(resolveApiBase("dns.example.test")).rejects.toBeInstanceOf(ApiEndpointConnectionError);
    expect(requests.map((request) => request.url)).toEqual(["https://dns.example.test/api/health"]);
    expect(requests.every((request) => !request.headers.has("Authorization"))).toBe(true);
  });

  test("uses HTTP for a bare loopback endpoint", async () => {
    const requests: string[] = [];
    mockFetch(async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });

    expect(await resolveApiBase("localhost:3101")).toBe("http://localhost:3101");
    expect(requests).toEqual(["http://localhost:3101/api/health"]);
  });

  test("keeps HTTPS when it responds and does not try HTTP", async () => {
    const requests: string[] = [];
    mockFetch(async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });

    expect(await resolveApiBase("dns.example.test")).toBe("https://dns.example.test");
    expect(requests).toEqual(["https://dns.example.test/api/health"]);
  });

  test("reports failure after the safe protocol fails", async () => {
    const requests: string[] = [];
    mockFetch(async (input) => {
      requests.push(String(input));
      throw new TypeError("unreachable");
    });

    await expect(resolveApiBase("dns.example.test")).rejects.toBeInstanceOf(ApiEndpointConnectionError);
    expect(requests).toHaveLength(1);
  });

  test("does not downgrade an explicitly supplied HTTPS endpoint", async () => {
    const requests: string[] = [];
    mockFetch(async (input) => {
      requests.push(String(input));
      throw new TypeError("unreachable");
    });

    await expect(resolveApiBase("https://dns.example.test")).rejects.toBeInstanceOf(ApiEndpointConnectionError);
    expect(requests).toEqual(["https://dns.example.test/api/health"]);
  });
});
