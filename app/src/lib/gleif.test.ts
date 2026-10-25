import { describe, expect, it } from "vitest";
import { checkLei, isValidLei, namesMatch } from "./gleif";

const GALP = "213800GG5STMYV487X21";

function fakeGleif(records: Record<string, object>) {
  return (async (url: string) => {
    const lei = decodeURIComponent(url.split("/").pop()!);
    const r = records[lei];
    if (!r) return new Response("", { status: 404 });
    return Response.json({ data: { attributes: { lei, ...r } } });
  }) as unknown as typeof fetch;
}

const galpRecord = {
  entity: {
    legalName: { name: "GALP ENERGIA, S.A." },
    legalAddress: { country: "PT" },
    jurisdiction: "PT",
    registeredAs: "505060515",
    status: "ACTIVE",
  },
  registration: { status: "ISSUED", nextRenewalDate: "2027-05-01T00:00:00Z" },
};

describe("isValidLei", () => {
  it("accepts real LEIs", () => {
    expect(isValidLei(GALP)).toBe(true);
    expect(isValidLei("2138003319Y7NM75FG53")).toBe(true);
  });
  it("rejects bad checksums and formats", () => {
    expect(isValidLei("213800GG5STMYV487X22")).toBe(false);
    expect(isValidLei("213800GG5STMYV487X2")).toBe(false);
    expect(isValidLei("not-an-lei-at-all-00")).toBe(false);
  });
});

describe("namesMatch", () => {
  it.each([
    ["GALP ENERGIA, S.A.", "Galp Energia"],
    ["Harbor & Hearth Bakeries, Lda", "Harbor and Hearth Bakeries"],
    ["Northline Fitness OÜ", "Northline Fitness"],
    ["Café Lisboa, Lda.", "Cafe Lisboa"],
  ])("%s ~ %s", (a, b) => expect(namesMatch(a, b)).toBe(true));

  it.each([
    ["GALP ENERGIA, S.A.", "Andes Craft Brewing"],
    ["Northline Fitness OÜ", "Southline Bakery"],
  ])("%s !~ %s", (a, b) => expect(namesMatch(a, b)).toBe(false));
});

describe("checkLei", () => {
  const gleif = fakeGleif({ [GALP]: galpRecord });

  it("passes an active LEI with matching name and country", async () => {
    const r = await checkLei(GALP, { name: "Galp Energia", countryAlpha2: "PT" }, gleif);
    expect(r.ok).toBe(true);
    expect(r.record?.registeredAs).toBe("505060515");
  });

  it("explains every mismatch", async () => {
    const r = await checkLei(GALP, { name: "Andes Craft Brewing", countryAlpha2: "CL" }, gleif);
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(2);
  });

  it("rejects lapsed or inactive entities", async () => {
    const lapsed = fakeGleif({ [GALP]: { ...galpRecord, registration: { status: "LAPSED" } } });
    const r = await checkLei(GALP, { name: "Galp Energia", countryAlpha2: "PT" }, lapsed);
    expect(r.problems[0]).toMatch(/lapsed/);
  });

  it("rejects unknown and malformed LEIs", async () => {
    expect((await checkLei("2138003319Y7NM75FG53", { name: "x", countryAlpha2: "PT" }, gleif)).problems[0]).toMatch(/no record/);
    expect((await checkLei("123", { name: "x", countryAlpha2: "PT" }, gleif)).problems[0]).toMatch(/valid LEI/);
  });
});
