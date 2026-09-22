import { afterEach, describe, expect, test } from "bun:test";
import { ApiEndpointConnectionError, resolveApiBase } from "./api";

const originalFetch = globalThis.fetch;

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = Object.assign(handler, { preconnect: originalFetch.preconnect }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
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
