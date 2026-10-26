import { describe, expect, it } from "vitest";
import { sectorFromNace } from "./sectors";

describe("sectors from NACE codes", () => {
  it("reads every registry's format", () => {
    expect(sectorFromNace("10.71A")).toBe("Bakery"); // France (NAF)
    expect(sectorFromNace("10.830")).toBe("Coffee roasting"); // Norway
    expect(sectorFromNace("56110")).toBe("Restaurants"); // Czechia
    expect(sectorFromNace("931300")).toBe("Fitness"); // Denmark (DB07)
  });
  it("falls back to the division, then to nothing", () => {
    expect(sectorFromNace("47.19")).toBe("Retail");
    expect(sectorFromNace("00")).toBeNull();
    expect(sectorFromNace(null)).toBeNull();
  });
});
