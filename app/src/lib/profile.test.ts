import { describe, expect, it } from "vitest";
import { encodeProfile, parseProfile } from "./chain";

describe("company profiles", () => {
  const p = { sector: "Coffee", city: "Porto", description: "60 cafés — 2 espresso bars ☕", netProfit: 1 };

  it("round-trips any text as UTF-8", () => {
    expect(parseProfile({ name: "x", profile_uri: encodeProfile(p) })).toEqual(p);
  });

  it("still reads profiles written as Latin-1", () => {
    const uri = "data:application/json;base64," + btoa(JSON.stringify({ ...p, description: "cafés" }));
    expect(parseProfile({ name: "x", profile_uri: uri }).description).toBe("cafés");
  });
});
