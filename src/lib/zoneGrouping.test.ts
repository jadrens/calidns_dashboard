import { describe, expect, test } from "bun:test";
import { getZoneDepthGroup, suggestZoneDomains } from "./zoneGrouping";

describe("zone depth grouping", () => {
  test("groups plain domains by their rightmost labels", () => {
    expect(getZoneDepthGroup("www.aaa.com", 1)).toBe("com");
    expect(getZoneDepthGroup("www.aaa.com", 2)).toBe("aaa.com");
    expect(getZoneDepthGroup("www.aaa.com", 3)).toBe("www.aaa.com");
  });

  test("understands the regex patterns used by zones", () => {
    expect(getZoneDepthGroup("^www\\.bbb\\.cn\\.?$", 1)).toBe("cn");
    expect(getZoneDepthGroup("^www\\.bbb\\.cn\\.?$", 2)).toBe("bbb.cn");
  });

  test("uses the whole domain when it is shallower than the requested depth", () => {
    expect(getZoneDepthGroup("cc.io", 4)).toBe("cc.io");
  });
});

describe("zone domain suggestions", () => {
  const saved = ["www.jadren.cn", "api.jadren.cn", "^shns\\.koi\\.ci\\.?$"];

  test("completes a bare label with saved parent domains, most used first", () => {
    expect(suggestZoneDomains("_esaauth", saved)).toEqual([
      "_esaauth.jadren.cn",
      "_esaauth.koi.ci",
      "_esaauth.shns.koi.ci",
      "_esaauth.api.jadren.cn",
      "_esaauth.www.jadren.cn",
    ]);
  });

  test("narrows by a partially typed parent", () => {
    expect(suggestZoneDomains("_esaauth.ja", saved)).toEqual(["_esaauth.jadren.cn"]);
    expect(suggestZoneDomains("a.b.ko", saved)).toEqual(["a.b.koi.ci"]);
  });

  test("skips domains that already exist and the exact input", () => {
    expect(suggestZoneDomains("www", saved)).not.toContain("www.jadren.cn");
    expect(suggestZoneDomains("x.jadren.cn", saved)).not.toContain("x.jadren.cn");
  });

  test("returns nothing for empty input", () => {
    expect(suggestZoneDomains("  ", saved)).toEqual([]);
  });
});
