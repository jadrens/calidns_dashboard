import { describe, expect, test } from "bun:test";
import { getZoneDepthGroup } from "./zoneGrouping";

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
