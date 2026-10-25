import { describe, expect, it } from "vitest";
import { checkDomain, expectedRecord, lookupTxt, normalizeDomain } from "./dns";

const OWNER = "GBZ2SBY44CCZKPZDCJELPZL7ED44RDPVARMJ7PQT33TRF5KFFVZ7V5HO";

/** A fake DoH resolver answering from a table of name -> TXT data strings. */
function fakeDns(table: Record<string, string[]>, opts: { failFirst?: boolean } = {}) {
  let calls = 0;
  return (async (url: string) => {
    calls++;
    if (opts.failFirst && calls === 1) return new Response("down", { status: 503 });
    const name = new URL(url).searchParams.get("name")!;
    const answers = table[name];
    return Response.json({
      Status: answers ? 0 : 3,
      Answer: answers?.map((data) => ({ type: 16, data })),
    });
  }) as unknown as typeof fetch;
}

describe("normalizeDomain", () => {
  it.each([
    ["https://www.Harbor-Hearth.pt/about?x=1", "harbor-hearth.pt"],
    ["northline.ee", "northline.ee"],
    ["http://shop.example.co.uk:8080/", "shop.example.co.uk"],
    ["example.com.", "example.com"],
  ])("%s -> %s", (input, out) => expect(normalizeDomain(input)).toBe(out));

  it.each(["", "localhost", "http://127.0.0.1", "not a domain", "-bad-.com", undefined])("rejects %s", (input) =>
    expect(normalizeDomain(input)).toBeNull(),
  );
});

describe("lookupTxt", () => {
  it("joins records split into quoted chunks", async () => {
    const dns = fakeDns({ "example.com": ['"dvdnd-verify=7:GABC" "DEF"', '"v=spf1 -all"'] });
    expect(await lookupTxt("example.com", dns)).toEqual(["dvdnd-verify=7:GABCDEF", "v=spf1 -all"]);
  });

  it("treats a missing name as no records", async () => {
    expect(await lookupTxt("nothing.example", fakeDns({}))).toEqual([]);
  });

  it("falls back to the second resolver", async () => {
    const dns = fakeDns({ "example.com": ['"hello"'] }, { failFirst: true });
    expect(await lookupTxt("example.com", dns)).toEqual(["hello"]);
  });
});

describe("checkDomain", () => {
  const expected = expectedRecord(3, OWNER);

  it("verifies a record on the _dvdnd subdomain", async () => {
    const r = await checkDomain("northline.ee", 3, OWNER, fakeDns({ "_dvdnd.northline.ee": [`"${expected}"`] }));
    expect(r).toMatchObject({ verified: true, foundAt: "_dvdnd.northline.ee" });
  });

  it("verifies a record on the domain itself", async () => {
    const r = await checkDomain("northline.ee", 3, OWNER, fakeDns({ "northline.ee": ['"v=spf1 -all"', `"${expected}"`] }));
    expect(r).toMatchObject({ verified: true, foundAt: "northline.ee" });
  });

  it("rejects a record for another company or wallet, and reports it", async () => {
    const other = expectedRecord(4, OWNER);
    const r = await checkDomain("northline.ee", 3, OWNER, fakeDns({ "_dvdnd.northline.ee": [`"${other}"`] }));
    expect(r.verified).toBe(false);
    expect(r.seen).toEqual([`_dvdnd.northline.ee: ${other}`]);
  });

  it("rejects when there is no record", async () => {
    expect((await checkDomain("northline.ee", 3, OWNER, fakeDns({}))).verified).toBe(false);
  });
});
